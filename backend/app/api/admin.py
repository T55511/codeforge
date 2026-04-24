"""管理者向けAPIエンドポイント"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.database import get_db
from app.models.language import Language
from app.models.tag import Tag, TagDependency
from app.models.problem import Problem
from app.models.user import User
from app.schemas.language import LanguageCreate, LanguageUpdate, LanguageOut
from app.schemas.tag import TagCreate, TagUpdate, TagOut, TagDependencyCreate
from app.schemas.problem import (
    ProblemCreate, ProblemUpdate, ProblemAdminOut,
    ExecuteResponse, GenerateProblemsRequest,
)
from app.services.auth import get_admin_user
from app.services.judgment import judge
from app.services.ai import generate_problems
from app.workers.tasks import generate_problems_task

router = APIRouter(prefix="/admin", tags=["admin"])


# ---- 統計 ----

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    user_count = (await db.execute(select(func.count(User.id)))).scalar_one()
    problem_count = (await db.execute(select(func.count(Problem.id)))).scalar_one()
    tag_count = (await db.execute(select(func.count(Tag.id)))).scalar_one()
    approved_count = (await db.execute(
        select(func.count(Problem.id)).where(Problem.status == "APPROVED")
    )).scalar_one()
    return {
        "user_count": user_count,
        "problem_count": problem_count,
        "tag_count": tag_count,
        "approved_count": approved_count,
    }


# ---- 言語管理 ----

@router.get("/languages", response_model=list[LanguageOut])
async def list_all_languages(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(Language).order_by(Language.sort_order))
    return result.scalars().all()


@router.post("/languages", response_model=LanguageOut, status_code=201)
async def create_language(
    body: LanguageCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    lang = Language(**body.model_dump())
    db.add(lang)
    await db.commit()
    await db.refresh(lang)
    return lang


@router.patch("/languages/{language_id}", response_model=LanguageOut)
async def update_language(
    language_id: uuid.UUID,
    body: LanguageUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(Language).where(Language.id == language_id))
    lang = result.scalar_one_or_none()
    if not lang:
        raise HTTPException(status_code=404, detail="言語が見つかりません")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(lang, field, value)

    await db.commit()
    await db.refresh(lang)
    return lang


# ---- スキル管理 ----

@router.get("/tags", response_model=list[TagOut])
async def list_tags(
    language_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(Tag).where(Tag.language_id == language_id).order_by(Tag.sort_order)
    )
    tags = result.scalars().all()
    # 依存関係をロード
    from sqlalchemy.orm import selectinload
    result2 = await db.execute(
        select(Tag)
        .options(selectinload(Tag.required_by))
        .where(Tag.language_id == language_id)
        .order_by(Tag.sort_order)
    )
    return result2.scalars().all()


@router.post("/tags", response_model=TagOut, status_code=201)
async def create_tag(
    body: TagCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    tag = Tag(**body.model_dump())
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.patch("/tags/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: uuid.UUID,
    body: TagUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="スキルが見つかりません")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tag, field, value)

    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="スキルが見つかりません")
    await db.delete(tag)
    await db.commit()


@router.post("/tag-dependencies", status_code=201)
async def create_tag_dependency(
    body: TagDependencyCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    dep = TagDependency(
        target_tag_id=body.target_tag_id,
        required_tag_id=body.required_tag_id,
        required_level=body.required_level,
    )
    db.add(dep)
    await db.commit()
    return {"ok": True}


# ---- 問題管理 ----

@router.get("/problems", response_model=list[ProblemAdminOut])
async def list_problems(
    language_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    query = select(Problem)
    if language_id:
        query = query.where(Problem.language_id == language_id)
    if tag_id:
        query = query.where(Problem.tag_id == tag_id)
    if status:
        query = query.where(Problem.status == status)
    result = await db.execute(query.order_by(Problem.created_at.desc()))
    return result.scalars().all()


@router.post("/problems", response_model=ProblemAdminOut, status_code=201)
async def create_problem(
    body: ProblemCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    problem = Problem(**body.model_dump(), status="AUTO_GENERATED")
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


@router.patch("/problems/{problem_id}", response_model=ProblemAdminOut)
async def update_problem(
    problem_id: uuid.UUID,
    body: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(problem, field, value)

    await db.commit()
    await db.refresh(problem)
    return problem


@router.post("/problems/{problem_id}/test")
async def test_problem(
    problem_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """模範解答をサンドボックスで実行して動作確認する"""
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    lang_result = await db.execute(select(Language).where(Language.id == problem.language_id))
    language = lang_result.scalar_one_or_none()

    judgment_result = await judge(
        code=problem.solution,
        language=language.name.lower() if language else "python",
        judgment_type=problem.judgment_type,
        expected_output=problem.expected_output,
        test_cases=problem.test_cases,
    )

    return {
        "verdict": judgment_result.verdict,
        "stdout": judgment_result.stdout,
        "diff": judgment_result.diff,
        "failed_case": judgment_result.failed_case,
        "error": (
            {
                "error_type": judgment_result.error.error_type,
                "message_ja": judgment_result.error.message_ja,
                "line_number": judgment_result.error.line_number,
            }
            if judgment_result.error
            else None
        ),
    }


@router.post("/problems/generate", response_model=ExecuteResponse, status_code=202)
async def generate_problems_endpoint(
    body: GenerateProblemsRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """AI問題一括生成をキューに積む"""
    task = generate_problems_task.delay(
        language_id=str(body.language_id),
        tag_id=str(body.tag_id),
        difficulty=body.difficulty,
        count=body.count,
        judgment_type=body.judgment_type,
    )
    return ExecuteResponse(task_id=task.id)
