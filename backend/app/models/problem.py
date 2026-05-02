import uuid
from datetime import datetime, timezone
from sqlalchemy import Integer, SmallInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    language_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("languages.id"), nullable=False)
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    initial_code: Mapped[str] = mapped_column(Text, nullable=False, default="")
    solution: Mapped[str] = mapped_column(Text, nullable=False)
    # VARCHAR でなく VARCHAR にしておくことで Phase 4以降の拡張が容易
    judgment_type: Mapped[str] = mapped_column(String, nullable=False)  # STDOUT / TESTCASE / UNITTEST / EXCEL_DRIVEN / UI_TEST
    test_cases: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    expected_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    efficiency_threshold_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    efficiency_threshold_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    difficulty: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)  # 1=入門/2=中級/3=応用
    status: Mapped[str] = mapped_column(String, nullable=False, default="AUTO_GENERATED")  # AUTO_GENERATED / APPROVED / ARCHIVED
    source: Mapped[str] = mapped_column(String, nullable=False, default="MANUAL")  # AI_GENERATED / MANUAL
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    language = relationship("Language", back_populates="problems")
    tag = relationship("Tag", back_populates="problems")
    submissions = relationship("Submission", back_populates="problem")
