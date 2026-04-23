"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "languages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("version", sa.String, nullable=False),
        sa.Column("icon_slug", sa.String, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "skill_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("language_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("languages.id"), nullable=False),
        # Phase 2用カラム: Phase 1では常にNULL
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skill_templates.id"), nullable=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("max_level", sa.Integer, nullable=False, server_default="5"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "tag_dependencies",
        sa.Column("target_tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tags.id"), primary_key=True),
        sa.Column("required_tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tags.id"), primary_key=True),
        sa.Column("required_level", sa.Integer, nullable=False, server_default="1"),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("email", sa.String, unique=True, nullable=False),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("rank", sa.String, nullable=False, server_default="'ブロンズコーダー'"),
        sa.Column("total_exp", sa.Integer, nullable=False, server_default="0"),
        sa.Column("streak_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "user_quotas",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("daily_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("limit", sa.Integer, nullable=False, server_default="10"),
        sa.Column("reset_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "user_tag_progress",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tags.id"), primary_key=True),
        sa.Column("current_level", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_exp", sa.Integer, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "problems",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("language_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("languages.id"), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tags.id"), nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("initial_code", sa.Text, nullable=False, server_default="''"),
        sa.Column("solution", sa.Text, nullable=False),
        sa.Column("judgment_type", sa.String, nullable=False),
        sa.Column("test_cases", postgresql.JSONB, nullable=True),
        sa.Column("expected_output", sa.Text, nullable=True),
        sa.Column("efficiency_threshold_ms", sa.Integer, nullable=True),
        sa.Column("efficiency_threshold_kb", sa.Integer, nullable=True),
        sa.Column("difficulty", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("status", sa.String, nullable=False, server_default="'AUTO_GENERATED'"),
        sa.Column("source", sa.String, nullable=False, server_default="'MANUAL'"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id"), nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("result", sa.String, nullable=False),
        sa.Column("exp_earned", sa.Integer, nullable=False, server_default="0"),
        sa.Column("runtime_ms", sa.Integer, nullable=True),
        sa.Column("memory_kb", sa.Integer, nullable=True),
        sa.Column("hint_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("submitted_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "ai_skill_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skill_templates.id"), nullable=False),
        sa.Column("suggested_tag_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.String, nullable=False, server_default="'PENDING'"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("ai_skill_suggestions")
    op.drop_table("submissions")
    op.drop_table("problems")
    op.drop_table("user_tag_progress")
    op.drop_table("user_quotas")
    op.drop_table("users")
    op.drop_table("tag_dependencies")
    op.drop_table("tags")
    op.drop_table("skill_templates")
    op.drop_table("languages")
