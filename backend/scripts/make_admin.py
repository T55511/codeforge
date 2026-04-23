"""指定メールアドレスのユーザーに管理者権限を付与するスクリプト

使い方:
  python scripts/make_admin.py <email>

Docker環境:
  docker-compose exec backend python scripts/make_admin.py admin@example.com
"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://codeforge:codeforge@localhost:5432/codeforge",
)


async def make_admin(email: str) -> None:
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        from app.models.user import User
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"ユーザーが見つかりません: {email}")
            sys.exit(1)
        if user.is_admin:
            print(f"{email} はすでに管理者です")
            return
        await session.execute(
            update(User).where(User.email == email).values(is_admin=True)
        )
        await session.commit()
        print(f"✓ {email} を管理者に設定しました")

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使い方: python scripts/make_admin.py <email>")
        sys.exit(1)
    asyncio.run(make_admin(sys.argv[1]))
