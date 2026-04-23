"""STDOUT / TESTCASE 判定エンジン"""
from dataclasses import dataclass
from typing import Optional
from app.services.sandbox import ExecutionResult, execute_code
from app.services.error_translator import translate_error, TranslatedError


@dataclass
class JudgmentResult:
    verdict: str  # PASS / FAIL / ERROR / TIMEOUT
    error: Optional[TranslatedError]
    diff: Optional[str]
    failed_case: Optional[dict]
    stdout: str


async def judge(
    code: str,
    language: str,
    judgment_type: str,
    expected_output: Optional[str],
    test_cases: Optional[list],
    stdin: str = "",
) -> JudgmentResult:
    """コードを実行し判定する"""

    if judgment_type == "STDOUT":
        return await _judge_stdout(code, language, expected_output or "", stdin)
    elif judgment_type == "TESTCASE":
        return await _judge_testcase(code, language, test_cases or [])
    else:
        raise ValueError(f"未対応の judgment_type: {judgment_type}")


async def _judge_stdout(code: str, language: str, expected_output: str, stdin: str) -> JudgmentResult:
    result = await execute_code(code, language, stdin)

    error = translate_error(result.stderr, result.exit_code, result.timed_out, language)

    if result.timed_out:
        return JudgmentResult(verdict="TIMEOUT", error=error, diff=None, failed_case=None, stdout="")

    if result.exit_code != 0:
        return JudgmentResult(verdict="ERROR", error=error, diff=None, failed_case=None, stdout=result.stdout)

    actual = result.stdout.strip()
    expected = expected_output.strip()

    if actual == expected:
        return JudgmentResult(verdict="PASS", error=None, diff=None, failed_case=None, stdout=actual)

    diff = _make_diff(expected, actual)
    return JudgmentResult(verdict="FAIL", error=None, diff=diff, failed_case=None, stdout=actual)


async def _judge_testcase(code: str, language: str, test_cases: list) -> JudgmentResult:
    """各テストケースを順番に assert で検証する"""

    for idx, tc in enumerate(test_cases):
        input_val = tc.get("input", "")
        expected = tc.get("expected_output", "")

        wrapped_code = _wrap_testcase_code(code, language, input_val, expected)
        result = await execute_code(wrapped_code, language)

        error = translate_error(result.stderr, result.exit_code, result.timed_out, language)

        if result.timed_out:
            return JudgmentResult(verdict="TIMEOUT", error=error, diff=None, failed_case=None, stdout="")

        if result.exit_code != 0:
            failed_case = {
                "case_index": idx + 1,
                "input": input_val,
                "expected": expected,
                "actual": result.stderr.strip(),
            }
            return JudgmentResult(verdict="FAIL", error=error, diff=None, failed_case=failed_case, stdout="")

        actual_output = result.stdout.strip()
        if actual_output != "PASS":
            actual_val = actual_output.replace("FAIL:", "").strip()
            failed_case = {
                "case_index": idx + 1,
                "input": input_val,
                "expected": expected,
                "actual": actual_val,
            }
            return JudgmentResult(verdict="FAIL", error=None, diff=None, failed_case=failed_case, stdout="")

    return JudgmentResult(verdict="PASS", error=None, diff=None, failed_case=None, stdout="")


def _wrap_testcase_code(user_code: str, language: str, input_val: str, expected: str) -> str:
    """ユーザーコードにテストケース検証ロジックを追加する"""
    if language.lower() == "python":
        return f"""{user_code}

import sys
_input = {repr(input_val)}
_expected = {repr(expected)}
try:
    if isinstance(_input, str):
        _actual = str(solve(_input)).strip()
    else:
        _actual = str(solve(*_input)).strip() if isinstance(_input, (list, tuple)) else str(solve(_input)).strip()
    if str(_actual).strip() == str(_expected).strip():
        print("PASS")
    else:
        print(f"FAIL: {{_actual}}")
except Exception as e:
    print(f"FAIL: {{e}}", file=sys.stderr)
    sys.exit(1)
"""
    elif language.lower() == "javascript":
        return f"""{user_code}

const _input = {json_repr(input_val)};
const _expected = {json_repr(expected)};
try {{
    const _actual = String(solve(_input)).trim();
    if (_actual === String(_expected).trim()) {{
        console.log("PASS");
    }} else {{
        console.log("FAIL: " + _actual);
    }}
}} catch (e) {{
    process.stderr.write("FAIL: " + e.message + "\\n");
    process.exit(1);
}}
"""
    else:
        return user_code


def json_repr(val: str) -> str:
    import json
    try:
        parsed = json.loads(val)
        return json.dumps(parsed)
    except Exception:
        return json.dumps(val)


def _make_diff(expected: str, actual: str) -> str:
    expected_lines = expected.splitlines()
    actual_lines = actual.splitlines()
    lines = []
    max_len = max(len(expected_lines), len(actual_lines))
    for i in range(max_len):
        exp = expected_lines[i] if i < len(expected_lines) else "(なし)"
        act = actual_lines[i] if i < len(actual_lines) else "(なし)"
        if exp != act:
            lines.append(f"行{i+1}: 期待値={repr(exp)} / 実際={repr(act)}")
    return "\n".join(lines) if lines else "差分なし"
