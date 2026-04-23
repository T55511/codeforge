# CodeForge 実装引き継ぎプロンプト（Claude Code用）

## このプロジェクトについて

「実務で自走できるエンジニア」を育成するAI駆動型プログラミング学習プラットフォームです。
複数のプログラミング言語に対応したスキルツリー形式の学習進行、ブラウザ上でのコード実行、AIによるソクラテスメソッドのヒント提供が主要機能です。

仕様書は `docs/` フォルダに以下の5ファイルがあります。実装前に必ず全て読んでください。

- `docs/01_Project_Charter_and_Roadmap.md`
- `docs/02_Functional_Specifications_Student.md`
- `docs/03_Admin_and_Content_Specifications.md`
- `docs/04_Technical_Infrastructure_Specifications.md`
- `docs/05_Database_and_API_Specifications.md`

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| バックエンド | Python / FastAPI / Cloud Run（GCP） |
| データベース | PostgreSQL（Cloud SQL）/ Redis（Cloud Memorystore） |
| 非同期処理 | Celery + Redis |
| サンドボックス | Docker + gVisor |
| AI | Gemini（Vertex AI）/ GPT-4o（OpenAI） |
| フロントエンド | React（SPA） |

---

## データ構造の重要な設計決定事項

### 3層構造
```
languages（言語）
  └─ tags（スキル、language_id で言語に紐付け）
       ├─ tag_dependencies（スキル間の依存関係・解放条件）
       ├─ problems（問題、tag_id と language_id で紐付け）
       │    └─ submissions（ユーザーの提出履歴）
       └─ user_tag_progress（ユーザーのスキル習熟度）
```

### Phase 2移行のための先行カラム
`tags` テーブルに `template_id UUID NULL` を最初から定義すること。
Phase 1では常にNULL。Phase 2でAIが共通スキルを検出した際に `skill_templates` テーブルと紐付ける。
これにより将来のDBマイグレーションが不要になる。

---

## コード実行フローの設計

### 非同期フロー
```
① POST /execute        → task_id を即時返却（202）、Celeryキューに積む
② Celery Worker        → Docker（gVisor）でコード実行
                          リソース制限: タイムアウト2秒 / メモリ128MB / NW遮断
③ 判定エンジン         → エラー判定 → 正誤判定 → EXP計算 → Redis/DBに書込
④ GET /tasks/{task_id} → 500ms間隔でポーリング、最大10秒
```

### 判定方式（judgment_type）
`problems` テーブルの `judgment_type` カラムで問題ごとに切り替える。

**STDOUT**（基礎問題向け）
- ユーザーの標準出力と `expected_output` を Diff 比較（前後の空白・改行はトリム）
- 変数・型・ループ・条件分岐などの基礎問題に使用

**TESTCASE**（応用問題向け）
- `test_cases` JSONB の各ケースを `assert function(input) == expected` 形式で検証
- 関数・再帰・アルゴリズムなどの応用問題に使用
- 失敗時は「何番目のケースが・何の入力で・期待値と実際の値が何か」を返す

### エラー種別と日本語化（Phase 1から必須）
| 種別 | 検出方法 | ユーザー表示 |
|---|---|---|
| コンパイルエラー | exit code ≠ 0 + stderr に構文エラー | 日本語メッセージ＋エラー行番号 |
| 実行時エラー | 実行中の例外（IndexError等） | 日本語メッセージ＋スタックトレース翻訳 |
| タイムアウト | 2秒超過 | 「処理時間が超過しました。無限ループの可能性があります。」 |

### EXP計算ロジック
```python
# PASS後に計算
base_exp  = 10  # 同一タグ・難易度の連続解答で減衰: 100%→50%→20%→固定1pt
first_try = 5   # submissions でこの問題の提出回数が1回目なら加算
no_hint   = 5   # hint_count == 0 なら加算
clean     = 5   # Linter 警告0件なら加算
efficient = 5   # runtime_ms <= threshold_ms かつ memory_kb <= threshold_kb なら加算
```

---

## 主要APIエンドポイント

### 生徒側
```
GET  /me/dashboard              ダッシュボード情報
GET  /languages                 有効な言語一覧
GET  /skill-tree?language_id=   指定言語のスキルツリー全体
POST /execute                   コード実行（非同期）
GET  /tasks/{task_id}           実行結果ポーリング
POST /review                    PRレビュー要求
POST /chat                      AIヒント要求
```

### 管理者側
```
GET/POST   /admin/languages                  言語一覧・追加
PATCH      /admin/languages/{id}             言語の有効化・設定変更
GET/POST   /admin/tags?language_id=          スキル一覧・追加
PATCH      /admin/tags/{id}                  スキル設定変更
DELETE     /admin/tags/{id}                  スキル削除
POST       /admin/tag-dependencies           依存関係の追加
GET        /admin/problems                   問題一覧（language_id・tag_id・statusでフィルタ）
POST       /admin/problems                   問題の手動追加
PATCH      /admin/problems/{id}              問題の編集・承認・アーカイブ
POST       /admin/problems/{id}/test         模範解答のテスト実行
POST       /admin/problems/generate          AI一括生成キューに追加
```

---

## AIプロンプト設計の制約

AIヒント機能（POST /chat）では以下を必ずシステムプロンプトに含めること。

```
- 正解コードを絶対に直接提示しない
- ソクラテスメソッドで「気づき」を促す質問形式にする
- ユーザーのエラーログ・提出コードをコンテキストとして含める
- ヒント残り回数（user_quotas）をレスポンスに含める
```

---

## Phase 1実装の優先順位

以下の順で実装を進めてください。

1. **DBマイグレーション**
   - 上記5テーブルの作成（`template_id NULL` を忘れずに）
   - `judgment_type` ENUM の定義

2. **サンドボックス実装**
   - Docker + gVisor のセットアップ
   - 言語ごとのウォームスタンバイ（Redis でコンテナプール管理）
   - リソース制限・タイムアウト処理

3. **実行・判定エンジン**
   - `POST /execute` → Celery タスク
   - エラー判定と日本語化
   - STDOUT / TESTCASE の判定ロジック
   - EXP計算

4. **スキルツリーAPI**
   - 言語・スキル・依存関係のCRUD
   - ユーザーの習熟度・解放条件チェック

5. **AIヒントAPI**
   - `POST /chat` のソクラテスメソッドプロンプト
   - クォータ管理

6. **管理者API**
   - 問題の承認フロー
   - 管理者向けCRUD全般

7. **フロントエンド**
   - ダッシュボード・ワークスペース・スキルツリー・リザルト画面

---

## 補足・注意事項

- 正誤判定にAIは使わない。コストと速度の観点からDiff比較・assertで完結させる。
- AIを使うのは「ヒント」「PRレビュー」「問題生成」の3箇所のみ。
- Gemini（低コスト・高速）とGPT-4o（高精度）の使い分けは仕様書04を参照。
- `problems.status` の ENUM は `AUTO_GENERATED / APPROVED / ARCHIVED` の3値。
- フロントエンドのエディタはMonaco Editor（VSCode準拠）を使用。
- 将来的にExcelベースのテストケース・UIテスト課題（Selenium/Playwright）に対応できるよう、`judgment_type` はENUMではなくVARCHARにしておくと拡張しやすい。
