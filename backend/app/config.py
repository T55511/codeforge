from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://codeforge:codeforge@localhost:5432/codeforge"
    redis_url: str = "redis://localhost:6379/0"

    openai_api_key: str = ""
    google_cloud_project: str = ""
    google_cloud_location: str = "asia-northeast1"

    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    sandbox_timeout_seconds: int = 2
    sandbox_memory_mb: int = 128
    sandbox_container_pool_size: int = 3

    ai_hint_daily_limit: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
