"""EXP計算ロジック"""
from dataclasses import dataclass


EXP_DECAY_RATES = [1.0, 0.5, 0.2]  # 連続解答での減衰率
EXP_BASE = 10
EXP_FIRST_TRY = 5
EXP_NO_HINT = 5
EXP_CLEAN_CODE = 5
EXP_EFFICIENT = 5


@dataclass
class ExpBreakdown:
    base: int
    first_try: int
    no_hint: int
    clean_code: int
    efficient: int
    total: int


def calculate_exp(
    consecutive_in_tag: int,  # 同一タグ・難易度での連続解答数（0始まり）
    is_first_try: bool,
    hint_count: int,
    linter_warnings: int,
    runtime_ms: int | None,
    memory_kb: int | None,
    threshold_ms: int | None,
    threshold_kb: int | None,
) -> ExpBreakdown:
    """EXPを計算して内訳を返す"""

    # 基本EXP（連続解答で減衰）
    if consecutive_in_tag >= len(EXP_DECAY_RATES):
        base = 1  # 固定1pt
    else:
        base = max(1, int(EXP_BASE * EXP_DECAY_RATES[consecutive_in_tag]))

    first_try_bonus = EXP_FIRST_TRY if is_first_try else 0
    no_hint_bonus = EXP_NO_HINT if hint_count == 0 else 0
    clean_bonus = EXP_CLEAN_CODE if linter_warnings == 0 else 0

    efficient_bonus = 0
    if (
        runtime_ms is not None
        and memory_kb is not None
        and threshold_ms is not None
        and threshold_kb is not None
        and runtime_ms <= threshold_ms
        and memory_kb <= threshold_kb
    ):
        efficient_bonus = EXP_EFFICIENT

    total = base + first_try_bonus + no_hint_bonus + clean_bonus + efficient_bonus

    return ExpBreakdown(
        base=base,
        first_try=first_try_bonus,
        no_hint=no_hint_bonus,
        clean_code=clean_bonus,
        efficient=efficient_bonus,
        total=total,
    )
