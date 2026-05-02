"""生徒向けAPIエンドポイント"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.language import Language
from app.models.tag import Tag, TagDependency
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User, UserQuota, UserTagProgress
from app.schemas.language import LanguageOut
from app.schemas.tag import SkillTreeNode, TagDependencyOut
from app.schemas.problem import ExecuteRequest, ExecuteResponse, TaskResult, GiveupRequest, GiveupResponse, ProblemOut
from app.schemas.user import DashboardOut, ChatRequest, ChatResponse, ReviewRequest, ReviewResponse
from app.services.auth import get_current_user
from app.services.ai import get_hint, review_code, get_giveup_explanation
from app.workers.celery_app import celery_app
from app.workers.tasks import execute_code_task

router = APIRouter(tags=["student"])


@router.get("/languages", response_model=list[LanguageOut])
async def list_active_languages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Language).where(Language.is_active == True).order_by(Language.sort_order)
    )
    return result.scalars().all()


@router.get("/skill-tree", response_model=list[SkillTreeNode])
async def get_skill_tree(
    language_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tags_result = await db.execute(
        select(Tag)
        .where(Tag.language_id == language_id, Tag.is_active == True)
        .order_by(Tag.sort_order)
    )
    tags = tags_result.scalars().all()

    progress_result = await db.execute(
        select(UserTagProgress).where(
            UserTagProgress.user_id == current_user.id,
            UserTagProgress.tag_id.in_([t.id for t in tags]),
        )
    )
    progress_map = {p.tag_id: p for p in progress_result.scalars().all()}

    deps_result = await db.execute(
        select(TagDependency).where(
            TagDependency.target_tag_id.in_([t.id for t in tags])
        )
    )
    deps_by_target: dict[uuid.UUID, list[TagDependency]] = {}
    for dep in deps_result.scalars().all():
        deps_by_target.setdefault(dep.target_tag_id, []).append(dep)

    nodes = []
    for tag in tags:
        prog = progress_map.get(tag.id)
        current_level = prog.current_level if prog else 0
        current_exp = prog.current_exp if prog else 0

        # 解放条件チェック
        deps = deps_by_target.get(tag.id, [])
        is_unlocked = True
        for dep in deps:
            req_prog = progress_map.get(dep.required_tag_id)
            req_level = req_prog.current_level if req_prog else 0
            if req_level < dep.required_level:
                is_unlocked = False
                break

        nodes.append(
            SkillTreeNode(
                id=tag.id,
                language_id=tag.language_id,
                template_id=tag.template_id,
                name=tag.name,
                category=tag.category,
                max_level=tag.max_level,
                sort_order=tag.sort_order,
                is_active=tag.is_active,
                created_at=tag.created_at,
                dependencies=[
                    TagDependencyOut(required_tag_id=d.required_tag_id, required_level=d.required_level)
                    for d in deps
                ],
                current_level=current_level,
                current_exp=current_exp,
                is_unlocked=is_unlocked,
            )
        )

    return nodes


@router.get("/problems/{problem_id}", response_model=ProblemOut)
async def get_problem(
    problem_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """問題の詳細を取得する（solution は含まない）"""
    result = await db.execute(
        select(Problem).where(Problem.id == problem_id, Problem.status == "APPROVED")
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")
    return problem


@router.get("/problems/next")
async def get_next_problem(
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """指定タグの承認済み問題をランダムに1件返す"""
    result = await db.execute(
        select(Problem)
        .where(Problem.tag_id == tag_id, Problem.status == "APPROVED")
        .order_by(func.random())
        .limit(1)
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="このスキルには問題がまだありません")
    return {"problem_id": str(problem.id), "title": problem.title}


@router.get("/me/dashboard", response_model=DashboardOut)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    one_week_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    subs_result = await db.execute(
        select(Submission).where(
            Submission.user_id == current_user.id,
            Submission.submitted_at >= one_week_ago,
        )
    )
    recent_subs = subs_result.scalars().all()

    total = len(recent_subs)
    passed = sum(1 for s in recent_subs if s.result == "PASS")
    accuracy = (passed / total * 100) if total > 0 else 0.0

    # 次の1問: 未クリアの問題を難易度昇順でランダムに1件取得
    passed_ids_result = await db.execute(
        select(Submission.problem_id).where(
            Submission.user_id == current_user.id,
            Submission.result == "PASS",
        ).distinct()
    )
    passed_ids = [r[0] for r in passed_ids_result.all()]

    next_q = select(Problem).where(Problem.status == "APPROVED")
    if passed_ids:
        next_q = next_q.where(Problem.id.not_in(passed_ids))
    next_q = next_q.order_by(Problem.difficulty, func.random()).limit(1)

    next_problem = await db.execute(next_q)
    np = next_problem.scalar_one_or_none()

    return DashboardOut(
        user=current_user,
        weekly_accuracy=round(accuracy, 1),
        recent_error_summary="直近1週間のエラー傾向を分析中...",
        next_problem_id=np.id if np else None,
        next_problem_title=np.title if np else None,
    )


@router.post("/execute", response_model=ExecuteResponse, status_code=202)
async def execute_code(
    body: ExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem_result = await db.execute(
        select(Problem).where(Problem.id == body.problem_id, Problem.status == "APPROVED")
    )
    problem = problem_result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    lang_result = await db.execute(select(Language).where(Language.id == problem.language_id))
    language = lang_result.scalar_one_or_none()
    if not language:
        raise HTTPException(status_code=404, detail="言語が見つかりません")

    # 同一タグ・難易度での連続解答数を取得
    consecutive_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.user_id == current_user.id,
            Submission.problem_id.in_(
                select(Problem.id).where(
                    Problem.tag_id == problem.tag_id,
                    Problem.difficulty == problem.difficulty,
                )
            ),
            Submission.result == "PASS",
        )
    )
    consecutive_in_tag = consecutive_result.scalar() or 0

    task = execute_code_task.delay(
        task_id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        problem_id=str(problem.id),
        code=body.code,
        language=language.name.lower(),
        judgment_type=problem.judgment_type,
        expected_output=problem.expected_output,
        test_cases=problem.test_cases,
        hint_count=body.hint_count,
        consecutive_in_tag=consecutive_in_tag,
        threshold_ms=problem.efficiency_threshold_ms,
        threshold_kb=problem.efficiency_threshold_kb,
    )

    return ExecuteResponse(task_id=task.id)


@router.get("/tasks/{task_id}", response_model=TaskResult)
async def get_task_result(task_id: str):
    task = celery_app.AsyncResult(task_id)

    if task.state == "PENDING":
        return TaskResult(task_id=task_id, status="PENDING")
    elif task.state == "STARTED":
        return TaskResult(task_id=task_id, status="STARTED")
    elif task.state == "SUCCESS":
        result = task.result
        return TaskResult(
            task_id=task_id,
            status="COMPLETED",
            verdict=result.get("verdict"),
            stdout=result.get("stdout"),
            diff=result.get("diff"),
            failed_case=result.get("failed_case"),
            error=result.get("error"),
            exp_breakdown=result.get("exp_breakdown"),
            exp_earned=result.get("exp_earned", 0),
        )
    else:
        return TaskResult(task_id=task_id, status="FAILED", verdict="ERROR")


@router.post("/chat", response_model=ChatResponse)
async def chat_hint(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quota_result = await db.execute(
        select(UserQuota).where(UserQuota.user_id == current_user.id)
    )
    quota = quota_result.scalar_one_or_none()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if quota:
        if quota.reset_at <= now:
            quota.daily_count = 0
            quota.reset_at = now.replace(hour=0, minute=0, second=0) + timedelta(days=1)
        if quota.daily_count >= quota.limit:
            raise HTTPException(status_code=429, detail="本日のヒント上限に達しました。明日またお試しください。")
    else:
        quota = UserQuota(
            user_id=current_user.id,
            daily_count=0,
            limit=10,
            reset_at=now.replace(hour=0, minute=0, second=0) + timedelta(days=1),
        )
        db.add(quota)

    problem_result = await db.execute(select(Problem).where(Problem.id == body.problem_id))
    problem = problem_result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    lang_result = await db.execute(select(Language).where(Language.id == problem.language_id))
    language = lang_result.scalar_one_or_none()

    try:
        reply = await get_hint(
            problem_description=problem.description,
            user_code=body.code,
            error_log=body.error_log,
            user_message=body.message,
            language=language.name if language else "python",
        )
    except Exception:
        raise HTTPException(status_code=503, detail="AIサービスが一時的に利用できません。しばらく後に再試行してください。")

    quota.daily_count += 1
    await db.commit()

    return ChatResponse(
        reply=reply,
        hints_remaining=quota.limit - quota.daily_count,
    )


@router.post("/review", response_model=ReviewResponse)
async def request_review(
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub_result = await db.execute(
        select(Submission).where(
            Submission.id == body.submission_id,
            Submission.user_id == current_user.id,
        )
    )
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="提出記録が見つかりません")

    problem_result = await db.execute(select(Problem).where(Problem.id == body.problem_id))
    problem = problem_result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    lang_result = await db.execute(select(Language).where(Language.id == problem.language_id))
    language = lang_result.scalar_one_or_none()

    try:
        comments = await review_code(
            problem_description=problem.description,
            code=submission.code,
            language=language.name if language else "python",
        )
    except Exception:
        raise HTTPException(status_code=503, detail="AIサービスが一時的に利用できません。しばらく後に再試行してください。")

    return ReviewResponse(comments=comments)


@router.post("/giveup", response_model=GiveupResponse)
async def giveup(
    body: GiveupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ギブアップ: 正解コード不提示の概念解説を返す。submissions に GIVEUP レコードを記録する。"""
    problem_result = await db.execute(
        select(Problem).where(Problem.id == body.problem_id, Problem.status == "APPROVED")
    )
    problem = problem_result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    lang_result = await db.execute(select(Language).where(Language.id == problem.language_id))
    language = lang_result.scalar_one_or_none()

    try:
        explanation, key_concepts = await get_giveup_explanation(
            problem_description=problem.description,
            user_code=body.code,
            language=language.name if language else "python",
        )
    except Exception:
        raise HTTPException(status_code=503, detail="AIサービスが一時的に利用できません。しばらく後に再試行してください。")

    # ギブアップ提出をDBに記録（EXP は付与しない）
    from app.models.submission import Submission
    submission = Submission(
        user_id=current_user.id,
        problem_id=problem.id,
        code=body.code,
        result="GIVEUP",
        exp_earned=0,
        hint_count=body.hint_count,
    )
    db.add(submission)
    await db.commit()

    return GiveupResponse(
        explanation=explanation,
        key_concepts=key_concepts,
        hints_used=body.hint_count,
    )


@router.get("/sandbox/pool-status")
async def get_pool_status(_: User = Depends(get_current_user)):
    """ウォームスタンバイプールの現在のコンテナ数を返す"""
    from app.services.pool_manager import pool_size
    from app.services.sandbox import LANGUAGE_IMAGES
    return {lang: pool_size(lang) for lang in LANGUAGE_IMAGES}
