"""認証エンドポイント"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User, UserQuota
from app.schemas.user import UserCreate, UserOut, TokenResponse, LoginRequest
from app.services.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="このメールアドレスはすでに登録されています")

    count_result = await db.execute(select(func.count(User.id)))
    is_first_user = count_result.scalar_one() == 0

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        is_admin=is_first_user,
    )
    db.add(user)
    await db.flush()

    quota = UserQuota(
        user_id=user.id,
        daily_count=0,
        limit=10,
        reset_at=datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, tzinfo=None) + timedelta(days=1),
    )
    db.add(quota)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )
    return {"access_token": create_access_token(user.id)}


@router.post("/claim-admin", response_model=UserOut)
async def claim_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """管理者が存在しない場合に限り、自分を管理者に昇格する。初回セットアップ用。"""
    admin_count_result = await db.execute(
        select(func.count(User.id)).where(User.is_admin == True)
    )
    if admin_count_result.scalar_one() > 0:
        raise HTTPException(status_code=403, detail="管理者がすでに存在します")

    current_user.is_admin = True
    await db.commit()
    await db.refresh(current_user)
    return current_user

