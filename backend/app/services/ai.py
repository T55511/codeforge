"""AI連携サービス（Gemini / GPT-4o）"""
import json
from openai import AsyncOpenAI
from app.config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

SOCRATIC_SYSTEM_PROMPT = """あなたはプログラミング学習プラットフォーム「CodeForge」のAIメンターです。
以下のルールを厳守してください：

1. 正解コードを絶対に直接提示しない
2. ソクラテスメソッドを用いて、学習者自身が「気づき」を得られるよう質問形式でヒントを出す
3. 質問例：「このエラーメッセージはどういう意味だと思いますか？」「変数の型を確認しましたか？」
4. 学習者のエラーログや提出コードを分析して、具体的な箇所を示すことはできるが、修正方法は直接教えない
5. 励ます言葉を適度に含める
6. 回答は日本語で行う
7. 1回のヒントは3〜5文程度に収める"""

CODE_REVIEW_SYSTEM_PROMPT = """あなたはシニアエンジニアとして、提出されたコードをレビューしてください。
以下の観点でコメントをJSON形式で返してください：

1. コードの可読性（命名、構造）
2. 効率性（計算量、メモリ使用）
3. ベストプラクティスへの準拠
4. 改善提案（修正コードは示さず、方向性のみ）

返却形式：
{"comments": [{"line": 行番号, "type": "improvement|warning|praise", "message": "コメント"}]}"""

PROBLEM_GENERATION_PROMPT_TEMPLATE = """プログラミング学習プラットフォーム用の問題を{count}問生成してください。

条件：
- 言語: {language_name}
- スキル: {tag_name}（カテゴリ: {category}）
- 難易度: {difficulty_label}
- 判定方式: {judgment_type}

各問題をJSON形式で返してください：
{{
  "problems": [
    {{
      "title": "問題タイトル",
      "description": "問題文（マークダウン形式）",
      "initial_code": "エディタ初期表示コード",
      "solution": "模範解答コード",
      "judgment_type": "{judgment_type}",
      "expected_output": "期待する標準出力（STDOUTの場合）",
      "test_cases": [{{"input": "入力", "expected_output": "期待出力"}}],
      "difficulty": {difficulty}
    }}
  ]
}}"""

DIFFICULTY_LABELS = {1: "入門", 2: "中級", 3: "応用"}


async def get_hint(
    problem_description: str,
    user_code: str,
    error_log: str,
    user_message: str,
    language: str,
) -> str:
    """ソクラテスメソッドでヒントを生成する（Gemini / GPT-4o）"""

    user_content = f"""問題文：
{problem_description}

学習者のコード（{language}）：
```
{user_code}
```

エラーログ：
{error_log if error_log else "なし"}

学習者からの質問：
{user_message}"""

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SOCRATIC_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=500,
        temperature=0.7,
    )

    return response.choices[0].message.content


async def review_code(
    problem_description: str,
    code: str,
    language: str,
) -> list[dict]:
    """AIシニアエンジニアによるコードレビュー（GPT-4o）"""

    user_content = f"""問題文：
{problem_description}

提出コード（{language}）：
```
{code}
```"""

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": CODE_REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=1000,
        temperature=0.5,
        response_format={"type": "json_object"},
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("comments", [])


async def generate_problems(
    language_name: str,
    tag_name: str,
    category: str,
    difficulty: int,
    judgment_type: str,
    count: int = 5,
) -> list[dict]:
    """Gemini/GPT-4oで問題を一括生成する"""

    prompt = PROBLEM_GENERATION_PROMPT_TEMPLATE.format(
        language_name=language_name,
        tag_name=tag_name,
        category=category,
        difficulty=difficulty,
        difficulty_label=DIFFICULTY_LABELS.get(difficulty, "入門"),
        judgment_type=judgment_type,
        count=count,
    )

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=3000,
        temperature=0.8,
        response_format={"type": "json_object"},
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("problems", [])


def generate_problems_sync(
    language_id: str,
    tag_id: str,
    difficulty: int,
    count: int,
) -> dict:
    """Celeryタスクから呼び出す同期版（DB操作はワーカー内で実施）"""
    return {"status": "queued", "language_id": language_id, "tag_id": tag_id, "difficulty": difficulty, "count": count}


GIVEUP_SYSTEM_PROMPT = """あなたはプログラミング学習プラットフォーム「CodeForge」のAIメンターです。
学習者がギブアップを選択しました。以下のルールで解説を提供してください：

1. 正解コードをそのまま提示してはいけない
2. 「なぜそのアプローチが正しいか」という概念・考え方を日本語で解説する
3. 学習者のコードのどこに問題があったかを具体的に指摘する
4. 次回同じ問題に取り組む際のヒントを「問い」の形で残す
5. 学習者の努力を称え、前向きな気持ちになれるメッセージで締める
6. JSONで返すこと: {"explanation": "解説文", "key_concepts": ["概念1", "概念2", ...]}"""


async def get_giveup_explanation(
    problem_description: str,
    user_code: str,
    language: str,
) -> tuple[str, list[str]]:
    """ギブアップ時の解説を生成する（正解コード不提示）"""

    user_content = f"""問題文：
{problem_description}

学習者が試みたコード（{language}）：
```
{user_code}
```

ギブアップしました。上記ルールに従って解説をJSON形式で返してください。"""

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": GIVEUP_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=800,
        temperature=0.6,
        response_format={"type": "json_object"},
    )

    result = json.loads(response.choices[0].message.content)
    explanation = result.get("explanation", "解説を生成できませんでした。")
    key_concepts = result.get("key_concepts", [])
    return explanation, key_concepts
