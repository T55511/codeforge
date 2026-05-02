import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rank: Mapped[str] = mapped_column(String, default="ブロンズコーダー", nullable=False)
    total_exp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    streak_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    submissions = relationship("Submission", back_populates="user")
    tag_progress = relationship("UserTagProgress", back_populates="user")
    quota = relationship("UserQuota", back_populates="user", uselist=False)


class UserQuota(Base):
    __tablename__ = "user_quotas"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    daily_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    limit: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    reset_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user = relationship("User", back_populates="quota")


class UserTagProgress(Base):
    __tablename__ = "user_tag_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True)
    current_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_exp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="tag_progress")
    tag = relationship("Tag", back_populates="user_progress")
