from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.student import router as student_router
from app.api.admin import router as admin_router
from app.database import engine, Base
import app.models  # 全てのモデルを読み込んでBaseに登録する

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時: 1. データベーステーブルの作成
    print("Initializing database tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database initialization complete.")
    except Exception as e:
        print(f"Database initialization failed: {e}")

    # 起動時: 2. ウォームスタンバイプールをバックグラウンドで補充
    try:
        from app.workers.tasks import warmup_all_pools_task
        warmup_all_pools_task.delay()
    except Exception:
        pass
    
    yield

    # シャットダウン時: プール内コンテナを破棄
    try:
        from app.workers.tasks import drain_all_pools_task
        drain_all_pools_task.delay()
    except Exception:
        pass


app = FastAPI(
    title="CodeForge API",
    description="AI駆動型プログラミング学習プラットフォーム",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://codeforge.example.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(student_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    from app.services.pool_manager import pool_size
    from app.services.sandbox import LANGUAGE_IMAGES
    try:
        pool_status = {lang: pool_size(lang) for lang in LANGUAGE_IMAGES}
    except Exception:
        pool_status = "unavailable"
    return {"status": "ok", "pool": pool_status}
