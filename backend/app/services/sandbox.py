"""Docker + gVisor によるセキュアなコード実行サンドボックス"""
import asyncio
import json
import time
import uuid
import docker
import redis as redis_sync
from dataclasses import dataclass
from app.config import settings

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

POOL_KEY_PREFIX = "sandbox:pool:"


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    runtime_ms: int
    memory_kb: int
    timed_out: bool


def get_redis_client() -> redis_sync.Redis:
    return redis_sync.from_url(settings.redis_url, decode_responses=True)


async def execute_code(code: str, language: str, stdin: str = "") -> ExecutionResult:
    """コードをDockerサンドボックスで実行する"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _execute_sync, code, language, stdin)


def _execute_sync(code: str, language: str, stdin: str = "") -> ExecutionResult:
    lang_key = language.lower()
    image = LANGUAGE_IMAGES.get(lang_key, f"{lang_key}:latest")
    run_cmd = LANGUAGE_RUN_COMMANDS.get(lang_key, [lang_key, "/code/main"])
    file_name = LANGUAGE_FILE_NAMES.get(lang_key, "main.py")

    client = docker.from_env()

    start = time.monotonic()
    try:
        container = client.containers.run(
            image=image,
            command=run_cmd,
            volumes={},
            environment={},
            network_disabled=True,
            mem_limit=f"{settings.sandbox_memory_mb}m",
            memswap_limit=f"{settings.sandbox_memory_mb}m",
            cpu_period=100000,
            cpu_quota=50000,  # 0.5 CPU
            detach=True,
            stdin_open=True,
            remove=False,
            # gVisor runtime (runsc) を使用する場合は runtime="runsc" を指定
            # runtime="runsc",
            labels={"codeforge": "sandbox"},
        )

        try:
            # コードをコンテナに書き込む
            import tarfile
            import io

            code_bytes = code.encode("utf-8")
            tar_stream = io.BytesIO()
            with tarfile.open(fileobj=tar_stream, mode="w") as tar:
                info = tarfile.TarInfo(name=file_name)
                info.size = len(code_bytes)
                tar.addfile(info, io.BytesIO(code_bytes))
            tar_stream.seek(0)
            container.put_archive("/code", tar_stream)

            # stdin がある場合はソケット経由で送信
            if stdin:
                sock = container.attach_socket(params={"stdin": 1, "stream": 1})
                sock._sock.sendall((stdin + "\n").encode())
                sock._sock.close()

            container.start()

            timeout = settings.sandbox_timeout_seconds
            try:
                exit_code = container.wait(timeout=timeout)["StatusCode"]
                timed_out = False
            except Exception:
                container.kill()
                timed_out = True
                exit_code = -1

            elapsed_ms = int((time.monotonic() - start) * 1000)

            logs = container.logs(stdout=True, stderr=True)
            stdout_logs = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            stderr_logs = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")

            stats = container.stats(stream=False)
            mem_usage = stats.get("memory_stats", {}).get("usage", 0)
            memory_kb = mem_usage // 1024

        finally:
            try:
                container.remove(force=True)
            except Exception:
                pass

    except docker.errors.ImageNotFound:
        return ExecutionResult(
            stdout="",
            stderr=f"実行環境イメージが見つかりません: {image}",
            exit_code=1,
            runtime_ms=0,
            memory_kb=0,
            timed_out=False,
        )

    return ExecutionResult(
        stdout=stdout_logs,
        stderr=stderr_logs,
        exit_code=exit_code,
        runtime_ms=elapsed_ms,
        memory_kb=memory_kb,
        timed_out=timed_out,
    )
