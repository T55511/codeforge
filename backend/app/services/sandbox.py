"""Docker + gVisor によるセキュアなコード実行サンドボックス。

実行戦略（ウォームスタンバイ優先）:
  1. Redis プールからスタンバイ済みコンテナを取得
  2. コードを tar で注入 → exec_run で実行（コンテナ再起動不要）
  3. 実行後コンテナを破棄 → 補充タスクをキューに積む
  4. プールが空の場合はフォールバックとして新規コンテナを即時起動（遅延は増加）
"""
import asyncio
import io
import logging
import tarfile
import time
import docker
from dataclasses import dataclass
from app.config import settings

logger = logging.getLogger(__name__)

LANGUAGE_IMAGES = {
    "python": "python:3.11-slim",
    "javascript": "node:20-slim",
    "java": "eclipse-temurin:21-jdk-slim",
    "go": "golang:1.22-alpine",
    "ruby": "ruby:3.3-slim",
}

LANGUAGE_RUN_COMMANDS = {
    "python": ["python", "/code/main.py"],
    "javascript": ["node", "/code/main.js"],
    "java": ["sh", "-c", "cd /code && javac Main.java && java Main"],
    "go": ["sh", "-c", "cd /code && go run main.go"],
    "ruby": ["ruby", "/code/main.rb"],
}

LANGUAGE_FILE_NAMES = {
    "python": "main.py",
    "javascript": "main.js",
    "java": "Main.java",
    "go": "main.go",
    "ruby": "main.rb",
}


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    runtime_ms: int
    memory_kb: int
    timed_out: bool


async def execute_code(code: str, language: str, stdin: str = "") -> ExecutionResult:
    """コードをDockerサンドボックスで実行する（非同期ラッパー）"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _execute_sync, code, language, stdin)


def _execute_sync(code: str, language: str, stdin: str = "") -> ExecutionResult:
    lang_key = language.lower()

    # ウォームスタンバイプールからコンテナを取得
    from app.services.pool_manager import pop_container, destroy_container, warmup_pool

    container_id = pop_container(lang_key)
    use_pool = container_id is not None

    client = docker.from_env()

    if use_pool:
        return _execute_on_standby(client, container_id, lang_key, code, stdin)
    else:
        # フォールバック: 新規コンテナを即時起動
        return _execute_fresh(client, lang_key, code, stdin)


def _execute_on_standby(
    client: docker.DockerClient,
    container_id: str,
    lang_key: str,
    code: str,
    stdin: str,
) -> ExecutionResult:
    """既存のスタンバイコンテナにコードを注入して実行する"""
    from app.services.pool_manager import destroy_container

    file_name = LANGUAGE_FILE_NAMES.get(lang_key, "main.py")
    run_cmd = LANGUAGE_RUN_COMMANDS.get(lang_key, ["python", "/code/main.py"])

    start = time.monotonic()
    try:
        container = client.containers.get(container_id)

        # /code ディレクトリを作成（存在しない場合）
        container.exec_run(["mkdir", "-p", "/code"])

        # コードを tar で注入
        _inject_code(container, file_name, code)

        # コードを実行（stdin はファイル経由）
        stdin_bytes = (stdin + "\n").encode() if stdin else None
        timeout = settings.sandbox_timeout_seconds

        timed_out = False
        try:
            exec_result = container.exec_run(
                run_cmd,
                stdin=bool(stdin_bytes),
                stdout=True,
                stderr=True,
                demux=True,
                environment={"PYTHONDONTWRITEBYTECODE": "1"},
            )
        except Exception:
            timed_out = True
            exec_result = None

        elapsed_ms = int((time.monotonic() - start) * 1000)
        timed_out = timed_out or (elapsed_ms > timeout * 1000)

        if timed_out or exec_result is None:
            return ExecutionResult(
                stdout="", stderr="", exit_code=-1,
                runtime_ms=elapsed_ms, memory_kb=0, timed_out=True,
            )

        stdout_b, stderr_b = exec_result.output or (b"", b"")
        stdout_str = (stdout_b or b"").decode("utf-8", errors="replace")
        stderr_str = (stderr_b or b"").decode("utf-8", errors="replace")

        try:
            stats = container.stats(stream=False)
            mem_usage = stats.get("memory_stats", {}).get("usage", 0)
            memory_kb = mem_usage // 1024
        except Exception as e:
            logger.debug("メモリ統計取得失敗 (%s): %s", container_id[:12], e)
            memory_kb = 0

        return ExecutionResult(
            stdout=stdout_str,
            stderr=stderr_str,
            exit_code=exec_result.exit_code,
            runtime_ms=elapsed_ms,
            memory_kb=memory_kb,
            timed_out=False,
        )
    except docker.errors.NotFound:
        # コンテナが見つからない場合はフレッシュ実行にフォールバック
        return _execute_fresh(client, lang_key, code, stdin)
    finally:
        # スタンバイコンテナは使用後必ず破棄し、補充タスクをキューに積む
        destroy_container(container_id)
        _schedule_pool_refill(lang_key)


def _execute_fresh(
    client: docker.DockerClient,
    lang_key: str,
    code: str,
    stdin: str,
) -> ExecutionResult:
    """新規コンテナを起動してコードを実行する（プール枯渇時のフォールバック）"""
    image = LANGUAGE_IMAGES.get(lang_key, f"{lang_key}:latest")
    run_cmd = LANGUAGE_RUN_COMMANDS.get(lang_key, ["python", "/code/main.py"])
    file_name = LANGUAGE_FILE_NAMES.get(lang_key, "main.py")

    start = time.monotonic()
    try:
        container = client.containers.run(
            image=image,
            command=["sleep", "infinity"],
            network_disabled=True,
            mem_limit=f"{settings.sandbox_memory_mb}m",
            memswap_limit=f"{settings.sandbox_memory_mb}m",
            cpu_period=100000,
            cpu_quota=50000,
            detach=True,
            remove=False,
            labels={"codeforge": "sandbox-fresh"},
        )
        try:
            container.exec_run(["mkdir", "-p", "/code"])
            _inject_code(container, file_name, code)

            timeout = settings.sandbox_timeout_seconds
            timed_out = False
            try:
                exec_result = container.exec_run(
                    run_cmd,
                    stdout=True,
                    stderr=True,
                    demux=True,
                )
            except Exception:
                timed_out = True
                exec_result = None

            elapsed_ms = int((time.monotonic() - start) * 1000)
            timed_out = timed_out or (elapsed_ms > timeout * 1000)

            if timed_out or exec_result is None:
                return ExecutionResult(
                    stdout="", stderr="", exit_code=-1,
                    runtime_ms=elapsed_ms, memory_kb=0, timed_out=True,
                )

            stdout_b, stderr_b = exec_result.output or (b"", b"")
            stdout_str = (stdout_b or b"").decode("utf-8", errors="replace")
            stderr_str = (stderr_b or b"").decode("utf-8", errors="replace")

            try:
                stats = container.stats(stream=False)
                mem_usage = stats.get("memory_stats", {}).get("usage", 0)
                memory_kb = mem_usage // 1024
            except Exception:
                memory_kb = 0

            return ExecutionResult(
                stdout=stdout_str,
                stderr=stderr_str,
                exit_code=exec_result.exit_code,
                runtime_ms=elapsed_ms,
                memory_kb=memory_kb,
                timed_out=False,
            )
        finally:
            try:
                container.remove(force=True)
            except Exception as e:
                logger.warning("フレッシュコンテナ削除失敗: %s", e)

    except docker.errors.ImageNotFound:
        return ExecutionResult(
            stdout="",
            stderr=f"実行環境イメージが見つかりません: {image}",
            exit_code=1,
            runtime_ms=0,
            memory_kb=0,
            timed_out=False,
        )


def _inject_code(container: docker.models.containers.Container, file_name: str, code: str) -> None:
    """コードを tar アーカイブとしてコンテナの /code に注入する"""
    code_bytes = code.encode("utf-8")
    tar_stream = io.BytesIO()
    with tarfile.open(fileobj=tar_stream, mode="w") as tar:
        info = tarfile.TarInfo(name=file_name)
        info.size = len(code_bytes)
        tar.addfile(info, io.BytesIO(code_bytes))
    tar_stream.seek(0)
    container.put_archive("/code", tar_stream)


def _schedule_pool_refill(lang_key: str) -> None:
    """プール補充タスクを Celery キューに非同期で積む"""
    try:
        from app.workers.tasks import refill_pool_task
        refill_pool_task.delay(lang_key)
    except Exception as e:
        logger.warning("プール補充タスクのキュー投入失敗 (%s): %s", lang_key, e)
