"""Celery 非同期タスク"""
import asyncio
from app.workers.celery_app import celery_app
from app.services.judgment import judge
from app.services.exp_calculator import calculate_exp


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
    """コード実行・判定・EXP計算を非同期で実行する"""
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
def generate_problems_task(language_id: str, tag_id: str, difficulty: int, count: int = 5):
    """AIによる問題一括生成タスク（管理者向け）"""
    from app.services.ai import generate_problems_sync
    return generate_problems_sync(language_id, tag_id, difficulty, count)


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
