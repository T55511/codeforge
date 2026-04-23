import uuid
from datetime import datetime
from pydantic import BaseModel


class TagDependencyOut(BaseModel):
    required_tag_id: uuid.UUID
    required_level: int

    model_config = {"from_attributes": True}


class TagBase(BaseModel):
    name: str
    category: str
    max_level: int = 5
    sort_order: int = 0
    is_active: bool = True


class TagCreate(TagBase):
    language_id: uuid.UUID


class TagUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    max_level: int | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class TagOut(TagBase):
    id: uuid.UUID
    language_id: uuid.UUID
    template_id: uuid.UUID | None
    created_at: datetime
    dependencies: list[TagDependencyOut] = []

    model_config = {"from_attributes": True}


class TagDependencyCreate(BaseModel):
    target_tag_id: uuid.UUID
    required_tag_id: uuid.UUID
    required_level: int = 1


class SkillTreeNode(TagOut):
    current_level: int = 0
    current_exp: int = 0
    is_unlocked: bool = False
