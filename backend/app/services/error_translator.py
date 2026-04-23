"""エラーメッセージの日本語化モジュール"""
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class TranslatedError:
    error_type: str  # COMPILE / RUNTIME / TIMEOUT
    message_ja: str
    line_number: Optional[int]
    detail: str


# Pythonのエラーパターン
PYTHON_ERROR_PATTERNS = [
    (r"SyntaxError: (.+)", "構文エラー: {0}"),
    (r"IndentationError: (.+)", "インデントエラー: {0}"),
    (r"NameError: name '(.+)' is not defined", "名前エラー: '{0}' が定義されていません"),
    (r"TypeError: (.+)", "型エラー: {0}"),
    (r"IndexError: (.+)", "インデックスエラー: {0}"),
    (r"KeyError: (.+)", "キーエラー: {0} というキーが存在しません"),
    (r"AttributeError: (.+)", "属性エラー: {0}"),
    (r"ValueError: (.+)", "値エラー: {0}"),
    (r"ZeroDivisionError: (.+)", "ゼロ除算エラー: ゼロで割ることはできません"),
    (r"RecursionError: (.+)", "再帰エラー: 再帰の深さが上限を超えました"),
    (r"ImportError: (.+)", "インポートエラー: {0}"),
    (r"ModuleNotFoundError: No module named '(.+)'", "モジュールエラー: '{0}' というモジュールが見つかりません"),
    (r"FileNotFoundError: (.+)", "ファイルエラー: {0}"),
    (r"MemoryError", "メモリエラー: メモリ使用量が上限を超えました"),
    (r"RuntimeError: (.+)", "実行時エラー: {0}"),
    (r"StopIteration", "イテレーション終了エラー"),
    (r"OverflowError: (.+)", "オーバーフローエラー: {0}"),
]

# JavaScriptのエラーパターン
JAVASCRIPT_ERROR_PATTERNS = [
    (r"SyntaxError: (.+)", "構文エラー: {0}"),
    (r"ReferenceError: (.+) is not defined", "参照エラー: '{0}' が定義されていません"),
    (r"TypeError: (.+)", "型エラー: {0}"),
    (r"RangeError: (.+)", "範囲エラー: {0}"),
    (r"URIError: (.+)", "URIエラー: {0}"),
]

LANGUAGE_PATTERNS = {
    "python": PYTHON_ERROR_PATTERNS,
    "javascript": JAVASCRIPT_ERROR_PATTERNS,
}


def translate_error(stderr: str, exit_code: int, timed_out: bool, language: str = "python") -> TranslatedError:
    """エラーを種別判定し日本語メッセージに変換する"""

    if timed_out:
        return TranslatedError(
            error_type="TIMEOUT",
            message_ja="処理時間が超過しました。無限ループの可能性があります。",
            line_number=None,
            detail="",
        )

    if not stderr and exit_code == 0:
        return TranslatedError(
            error_type="NONE",
            message_ja="",
            line_number=None,
            detail="",
        )

    line_number = _extract_line_number(stderr, language)

    is_compile_error = _is_compile_error(stderr, language)
    error_type = "COMPILE" if is_compile_error else "RUNTIME"

    message_ja = _translate_message(stderr, language)

    return TranslatedError(
        error_type=error_type,
        message_ja=message_ja,
        line_number=line_number,
        detail=stderr,
    )


def _extract_line_number(stderr: str, language: str) -> Optional[int]:
    """エラーメッセージから行番号を抽出する"""
    patterns = {
        "python": [r"line (\d+)", r"File .+, line (\d+)"],
        "javascript": [r":(\d+):\d+\)", r"at .+:(\d+):\d+"],
        "java": [r"\.java:(\d+)"],
        "go": [r":(\d+):"],
        "ruby": [r":(\d+):in"],
    }

    for pattern in patterns.get(language.lower(), [r"line (\d+)"]):
        match = re.search(pattern, stderr)
        if match:
            return int(match.group(1))
    return None


def _is_compile_error(stderr: str, language: str) -> bool:
    """コンパイルエラーかどうかを判定する"""
    compile_indicators = {
        "python": ["SyntaxError", "IndentationError", "TabError"],
        "javascript": ["SyntaxError"],
        "java": ["error:", "javac"],
        "go": ["syntax error", "undefined:", "cannot"],
        "ruby": ["SyntaxError"],
    }
    indicators = compile_indicators.get(language.lower(), ["SyntaxError"])
    return any(ind in stderr for ind in indicators)


def _translate_message(stderr: str, language: str) -> str:
    """エラーメッセージを日本語に変換する"""
    patterns = LANGUAGE_PATTERNS.get(language.lower(), PYTHON_ERROR_PATTERNS)

    for pattern, template in patterns:
        match = re.search(pattern, stderr)
        if match:
            groups = match.groups()
            try:
                return template.format(*groups)
            except (IndexError, KeyError):
                return template

    # パターンマッチしない場合は最初の行を返す
    first_line = stderr.strip().split("\n")[-1] if stderr.strip() else "不明なエラーが発生しました"
    return f"エラー: {first_line}"
