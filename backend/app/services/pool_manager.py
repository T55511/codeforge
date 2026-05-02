"""
Dockerコンテナのウォームスタンバイプール管理。
言語ごとに起動済みコンテナをRedisキューで管理し、実行遅延を1秒未満に抑制する。

設計:
  Redis key: sandbox:pool:<language>  → List of container IDs (LIFO stack)
  起動時 / 補充タスクが pool_size 個のコンテナを事前生成してキューに積む
  実行時: RPOP でコンテナを取得し、コード注入→実行→削除する
  削除後: 補充タスクを非同期で起動して空きを補填する
"""
import logging
import time
import uuid
import docker
import redis as redis_sync
from app.config import settings
from app.services.sandbox import LANGUAGE_IMAGES, LANGUAGE_RUN_COMMANDS

logger = logging.getLogger(__name__)

POOL_KEY_PREFIX = "sandbox:pool:"
POOL_LOCK_KEY_PREFIX = "sandbox:pool_lock:"
POOL_LOCK_TTL = 30  # seconds


def _redis() -> redis_sync.Redis:
    return redis_sync.from_url(settings.redis_url, decode_responses=True)


def _docker_client() -> docker.DockerClient:
    return docker.from_env()


# ---- プール操作 ----

def pool_size(language: str) -> int:
    """現在のプールサイズを返す"""
    r = _redis()
    return r.llen(f"{POOL_KEY_PREFIX}{language}")


def pop_container(language: str) -> str | None:
    """プールからコンテナIDを取り出す（なければ None）"""
    r = _redis()
    return r.rpop(f"{POOL_KEY_PREFIX}{language}")


def push_container(language: str, container_id: str) -> None:
    """プールにコンテナIDを追加する"""
    r = _redis()
    r.rpush(f"{POOL_KEY_PREFIX}{language}", container_id)


def remove_container_from_pool(language: str, container_id: str) -> None:
    """プールから特定のコンテナIDを削除する"""
    r = _redis()
    r.lrem(f"{POOL_KEY_PREFIX}{language}", 0, container_id)


# ---- コンテナのライフサイクル ----

def create_standby_container(language: str) -> str | None:
    """ウォームスタンバイ用コンテナを1つ作成してプールに登録し、コンテナIDを返す"""
    lang_key = language.lower()
    image = LANGUAGE_IMAGES.get(lang_key)
    if not image:
        return None

    client = _docker_client()
    try:
        # sleep infinity でコンテナを起動状態に保つ
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
            labels={"codeforge": "standby", "codeforge.language": lang_key},
        )
        push_container(lang_key, container.id)
        return container.id
    except Exception as e:
        print(f"[pool] コンテナ作成失敗 ({language}): {e}")
        return None


def destroy_container(container_id: str) -> None:
    """コンテナを強制停止・削除する"""
    try:
        client = _docker_client()
        container = client.containers.get(container_id)
        container.remove(force=True)
    except Exception as e:
        logger.warning("コンテナ削除失敗 (%s): %s", container_id[:12], e)


def warmup_pool(language: str, target_size: int | None = None) -> int:
    """プールを target_size まで補充する。作成した数を返す"""
    target = target_size or settings.sandbox_container_pool_size
    current = pool_size(language)
    created = 0
    for _ in range(max(0, target - current)):
        cid = create_standby_container(language)
        if cid:
            created += 1
    return created


def drain_pool(language: str) -> int:
    """プール内の全コンテナを停止・削除する（シャットダウン用）"""
    r = _redis()
    key = f"{POOL_KEY_PREFIX}{language}"
    removed = 0
    while True:
        cid = r.rpop(key)
        if not cid:
            break
        destroy_container(cid)
        removed += 1
    return removed


def warmup_all_languages() -> dict[str, int]:
    """全対象言語のプールを補充する"""
    results = {}
    from app.services.sandbox import LANGUAGE_IMAGES
    for lang in LANGUAGE_IMAGES:
        results[lang] = warmup_pool(lang)
    return results
