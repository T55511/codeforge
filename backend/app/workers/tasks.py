"""Celery 非同期タスク"""
import asyncio
import uuid
from datetime import datetime
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
            # 一発正解かどうかはDB確認が必要なため、タスク引数で受け取る
            # ここでは呼び出し元で計算済みの is_first_try を使う
            breakdown = calculate_exp(
                consecutive_in_tag=consecutive_in_tag,
                is_first_try=(consecutive_in_tag == 0),
                hint_count=hint_count,
                linter_warnings=0,  # Linterは将来実装
                runtime_ms=result.stdout and None or None,
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
    # AI生成ロジックはapp/services/ai.pyに実装
    from app.services.ai import generate_problems_sync
    return generate_problems_sync(language_id, tag_id, difficulty, count)
