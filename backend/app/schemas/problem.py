import uuid
from datetime import datetime
from pydantic import BaseModel


class ProblemBase(BaseModel):
    title: str
    description: str
    initial_code: str = ""
    judgment_type: str
    test_cases: list | None = None
    expected_output: str | None = None
    efficiency_threshold_ms: int | None = None
    efficiency_threshold_kb: int | None = None
    difficulty: int = 1


class ProblemCreate(ProblemBase):
    language_id: uuid.UUID
    tag_id: uuid.UUID
    solution: str
    source: str = "MANUAL"


class ProblemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    initial_code: str | None = None
    solution: str | None = None
    judgment_type: str | None = None
    test_cases: list | None = None
    expected_output: str | None = None
    efficiency_threshold_ms: int | None = None
    efficiency_threshold_kb: int | None = None
    difficulty: int | None = None
    status: str | None = None


class ProblemOut(ProblemBase):
    id: uuid.UUID
    language_id: uuid.UUID
    tag_id: uuid.UUID
    status: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemAdminOut(ProblemOut):
    solution: str


class ExecuteRequest(BaseModel):
    problem_id: uuid.UUID
    code: str
    hint_count: int = 0


class ExecuteResponse(BaseModel):
    task_id: str


class TaskResult(BaseModel):
    task_id: str
    status: str  # PENDING / STARTED / COMPLETED / FAILED
    verdict: str | None = None
    stdout: str | None = None
    diff: str | None = None
    failed_case: dict | None = None
    error: dict | None = None
    exp_breakdown: dict | None = None
    exp_earned: int = 0


class GenerateProblemsRequest(BaseModel):
    language_id: uuid.UUID
    tag_id: uuid.UUID
    difficulty: int = 1
    count: int = 5


class GiveupRequest(BaseModel):
    problem_id: uuid.UUID
    code: str
    hint_count: int = 0


class GiveupResponse(BaseModel):
    explanation: str       # ソクラテス的な解説（正解コードそのものは含まない）
    key_concepts: list[str]  # 今回の問題で学ぶべき概念リスト
    hints_used: int


class PoolStatusResponse(BaseModel):
    pool: dict[str, int]   # language -> コンテナ数
