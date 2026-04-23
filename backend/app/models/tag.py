import uuid
from datetime import datetime
from sqlalchemy import Boolean, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    language_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("languages.id"), nullable=False)
    # Phase 2用: NULL許容、Phase 1では常にNULL
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("skill_templates.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    max_level: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    language = relationship("Language", back_populates="tags")
    template = relationship("SkillTemplate", back_populates="tags")
    problems = relationship("Problem", back_populates="tag")
    user_progress = relationship("UserTagProgress", back_populates="tag")
    # 依存関係: このタグを解放するために必要な条件
    required_by = relationship("TagDependency", foreign_keys="TagDependency.target_tag_id", back_populates="target_tag")
    # 依存関係: このタグが前提となる解放先
    unlocks = relationship("TagDependency", foreign_keys="TagDependency.required_tag_id", back_populates="required_tag")


class TagDependency(Base):
    __tablename__ = "tag_dependencies"

    target_tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True)
    required_tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True)
    required_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    target_tag = relationship("Tag", foreign_keys=[target_tag_id], back_populates="required_by")
    required_tag = relationship("Tag", foreign_keys=[required_tag_id], back_populates="unlocks")
