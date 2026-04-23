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
    # 起動時にテーブルを作成
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

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
    return {"status": "ok"}
