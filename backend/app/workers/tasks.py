"""Celery 非同期タスク"""
import asyncio
import uuid as uuid_mod
from datetime import datetime, timezone
from app.workers.celery_app import celery_app
from app.services.judgment import judge
from app.services.exp_calculator import calculate_exp


RANK_THRESHOLDS = [
    (1000, "ダイヤモンドコーダー"),
    (600,  "プラチナコーダー"),
    (300,  "ゴールドコーダー"),
    (100,  "シルバーコーダー"),
    (0,    "ブロンズコーダー"),
]

EXP_PER_LEVEL = 50


def _calc_rank(total_exp: int) -> str:
    for threshold, rank in RANK_THRESHOLDS:
        if total_exp >= threshold:
            return rank
    return "ブロンズコーダー"


async def _save_execution_result(
    user_id: str,
    problem_id: str,
    code: str,
    verdict: str,
    hint_count: int,
    exp_total: int,
) -> None:
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.submission import Submission
    from app.models.user import User, UserTagProgress
    from app.models.problem import Problem
    from app.models.tag import Tag

    async with AsyncSessionLocal() as db:
        db.add(Submission(
            user_id=uuid_mod.UUID(user_id),
            problem_id=uuid_mod.UUID(problem_id),
            code=code,
            result=verdict,
            exp_earned=exp_total,
            hint_count=hint_count,
        ))

        if verdict == "PASS" and exp_total > 0:
            user = (await db.execute(
                select(User).where(User.id == uuid_mod.UUID(user_id))
            )).scalar_one_or_none()
            if user:
                user.total_exp += exp_total
                user.rank = _calc_rank(user.total_exp)

            problem = (await db.execute(
                select(Problem).where(Problem.id == uuid_mod.UUID(problem_id))
            )).scalar_one_or_none()
            if problem:
                tag = (await db.execute(
                    select(Tag).where(Tag.id == problem.tag_id)
                )).scalar_one_or_none()

                prog = (await db.execute(
                    select(UserTagProgress).where(
                        UserTagProgress.user_id == uuid_mod.UUID(user_id),
                        UserTagProgress.tag_id == problem.tag_id,
                    )
                )).scalar_one_or_none()
                if not prog:
                    prog = UserTagProgress(
                        user_id=uuid_mod.UUID(user_id),
                        tag_id=problem.tag_id,
                        current_level=0,
                        current_exp=0,
                        updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    )
                    db.add(prog)

                prog.current_exp += exp_total
                max_level = tag.max_level if tag else 5
                prog.current_level = min(max_level, prog.current_exp // EXP_PER_LEVEL)
                prog.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

        await db.commit()


@celery_app.task(bind=True, name="execute_code_task")
def execute_code_task(
    self,
    task_id: str,
    user_id: str,
    problem_id: str,
    code: str,
    language: str,
    judgment_type: str,
    expected_output: str | None,
    test_cases: list | None,
    hint_count: int,
    consecutive_in_tag: int,
    threshold_ms: int | None,
    threshold_kb: int | None,
):
    """コード実行・判定・EXP計算・DB保存を非同期で実行する"""
    try:
        result = asyncio.run(
            judge(
                code=code,
                language=language,
                judgment_type=judgment_type,
                expected_output=expected_output,
                test_cases=test_cases,
            )
        )

        exp_breakdown = None
        exp_total = 0

        if result.verdict == "PASS":
            breakdown = calculate_exp(
                consecutive_in_tag=consecutive_in_tag,
                is_first_try=(consecutive_in_tag == 0),
                hint_count=hint_count,
                linter_warnings=0,
                runtime_ms=None,
                memory_kb=None,
                threshold_ms=threshold_ms,
                threshold_kb=threshold_kb,
            )
            exp_total = breakdown.total
            exp_breakdown = {
                "base": breakdown.base,
                "first_try": breakdown.first_try,
                "no_hint": breakdown.no_hint,
                "clean_code": breakdown.clean_code,
                "efficient": breakdown.efficient,
                "total": breakdown.total,
            }

        asyncio.run(_save_execution_result(
            user_id=user_id,
            problem_id=problem_id,
            code=code,
            verdict=result.verdict,
            hint_count=hint_count,
            exp_total=exp_total,
        ))

        return {
            "task_id": task_id,
            "status": "COMPLETED",
            "verdict": result.verdict,
            "stdout": result.stdout,
            "diff": result.diff,
            "failed_case": result.failed_case,
            "error": (
                {
                    "error_type": result.error.error_type,
                    "message_ja": result.error.message_ja,
                    "line_number": result.error.line_number,
                    "detail": result.error.detail,
                }
                if result.error
                else None
            ),
            "exp_breakdown": exp_breakdown,
            "exp_earned": exp_total,
        }

    except Exception as exc:
        return {
            "task_id": task_id,
            "status": "FAILED",
            "verdict": "ERROR",
            "error": {
                "error_type": "SYSTEM",
                "message_ja": f"システムエラーが発生しました: {str(exc)}",
                "line_number": None,
                "detail": str(exc),
            },
            "exp_earned": 0,
        }


@celery_app.task(name="generate_problems_task")
def generate_problems_task(language_id: str, tag_id: str, difficulty: int, count: int = 5, judgment_type: str = "STDOUT"):
    """AIによる問題一括生成タスク（管理者向け）"""
    import uuid
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.language import Language
    from app.models.tag import Tag
    from app.models.problem import Problem
    from app.services.ai import generate_problems

    async def _run():
        async with AsyncSessionLocal() as db:
            lang = (await db.execute(
                select(Language).where(Language.id == uuid.UUID(language_id))
            )).scalar_one_or_none()
            tag = (await db.execute(
                select(Tag).where(Tag.id == uuid.UUID(tag_id))
            )).scalar_one_or_none()
            if not lang or not tag:
                return {"status": "ERROR", "error": "Language or Tag not found"}

            problems_data = await generate_problems(
                language_name=lang.name,
                tag_name=tag.name,
                category=tag.category,
                difficulty=difficulty,
                judgment_type=judgment_type,
                count=count,
            )

            titles = []
            for p in problems_data:
                # 必須フィールドが揃っていない問題はスキップ
                if not p.get("title") or not p.get("description") or not p.get("solution"):
                    continue
                problem = Problem(
                    language_id=lang.id,
                    tag_id=tag.id,
                    title=p["title"][:200],
                    description=p["description"],
                    initial_code=p.get("initial_code", ""),
                    solution=p["solution"],
                    judgment_type=p.get("judgment_type", judgment_type),
                    expected_output=p.get("expected_output"),
                    test_cases=p.get("test_cases"),
                    difficulty=int(p.get("difficulty", difficulty)),
                    status="AUTO_GENERATED",
                    source="AI_GENERATED",
                )
                db.add(problem)
                titles.append(p["title"])

            await db.commit()
            return {"status": "COMPLETED", "created": len(titles), "titles": titles}

    return asyncio.run(_run())


@celery_app.task(name="refill_pool_task")
def refill_pool_task(language: str) -> dict:
    """使用後のコンテナを補充してプールを維持する"""
    from app.services.pool_manager import warmup_pool
    created = warmup_pool(language)
    return {"language": language, "created": created}


@celery_app.task(name="warmup_all_pools_task")
def warmup_all_pools_task() -> dict:
    """全言語のウォームスタンバイプールを起動・補充する（起動時/定期実行）"""
    from app.services.pool_manager import warmup_all_languages
    results = warmup_all_languages()
    return {"results": results}


@celery_app.task(name="drain_all_pools_task")
def drain_all_pools_task() -> dict:
    """シャットダウン時に全プールのコンテナを停止・削除する"""
    from app.services.pool_manager import drain_pool
    from app.services.sandbox import LANGUAGE_IMAGES
    results = {}
    for lang in LANGUAGE_IMAGES:
        results[lang] = drain_pool(lang)
    return {"results": results}
