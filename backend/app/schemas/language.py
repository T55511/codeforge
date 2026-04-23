import uuid
from datetime import datetime
from pydantic import BaseModel


class LanguageBase(BaseModel):
    name: str
    version: str
    icon_slug: str
    sort_order: int = 0


class LanguageCreate(LanguageBase):
    pass


class LanguageUpdate(BaseModel):
    name: str | None = None
    version: str | None = None
    icon_slug: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class LanguageOut(LanguageBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
