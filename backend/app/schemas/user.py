import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    rank: str
    total_exp: int
    streak_days: int
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class DashboardOut(BaseModel):
    user: UserOut
    weekly_accuracy: float
    recent_error_summary: str
    next_problem_id: uuid.UUID | None
    next_problem_title: str | None


class ChatRequest(BaseModel):
    problem_id: uuid.UUID
    message: str
    code: str
    error_log: str = ""


class ChatResponse(BaseModel):
    reply: str
    hints_remaining: int


class ReviewRequest(BaseModel):
    problem_id: uuid.UUID
    code: str
    submission_id: uuid.UUID


class ReviewResponse(BaseModel):
    comments: list[dict]
