# 05. データベース・API仕様書

## 1. 設計方針

- **Phase 1（MVP）からPhase 2（テンプレート方式）への移行コストをゼロにする**ため、Phase 2で追加予定のカラム・テーブルを最初から定義しておく。
- Phase 1時点ではNULL許容カラムとして存在するだけでよく、機能として使わない。
- テーブルの階層は **言語 → スキル → 問題** の3層構造。

---

## 2. 主要テーブル定義

### `languages`（新規 / Phase 1）
言語マスタ。管理者が追加・有効化する。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| name | VARCHAR | 例: "Python" |
| version | VARCHAR | 例: "3.11" |
| icon_slug | VARCHAR | アイコン略称。例: "Py" |
| is_active | BOOLEAN | false = 準備中（生徒に非公開） |
| sort_order | INTEGER | サイドバー表示順 |
| created_at | TIMESTAMP | |

---

### `skill_templates`（新規 / Phase 2用・Phase 1からNULL許容で定義）
言語をまたぐ共通スキル概念のマスタ。例:「ループ」「再帰」。
Phase 1では使用しない（レコードを入れない）。AIが類似スキルを検出した際に提案の起点となる。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| name | VARCHAR | 例: "ループ" |
| category | VARCHAR | 例: "基礎" |
| description | TEXT | 概念の説明 |
| created_at | TIMESTAMP | |

---

### `tags`（既存を拡張）
各言語のスキルノード。スキルツリーの1ノード = 1レコード。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| language_id | UUID FK → languages.id | **Phase 1で追加**。言語ごとに独立 |
| template_id | UUID FK → skill_templates.id **NULL許容** | **Phase 2で使用**。NULL = テンプレート未紐付け |
| name | VARCHAR | 例: "ループ"（Python版） |
| category | VARCHAR | 例: "基礎" / "データ構造" / "アルゴリズム" |
| max_level | INTEGER | デフォルト5 |
| sort_order | INTEGER | ツリー上の表示順 |
| is_active | BOOLEAN | false = 生徒に非表示 |
| created_at | TIMESTAMP | |

---

### `tag_dependencies`（既存・変更なし）
スキル間の依存関係（解放条件）。同一言語内でのみ参照する。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| target_tag_id | UUID FK → tags.id | 解放されるスキル |
| required_tag_id | UUID FK → tags.id | 前提スキル |
| required_level | INTEGER | 必要な前提スキルのレベル |

---

### `user_tag_progress`（既存・変更なし）
ユーザーごとのスキル習熟度。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| user_id | UUID FK → users.id | |
| tag_id | UUID FK → tags.id | |
| current_level | INTEGER | |
| current_exp | INTEGER | |
| updated_at | TIMESTAMP | |

---

### `problems`（既存を拡張）
問題マスタ。AI生成・手動追加どちらも同テーブルで管理。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| language_id | UUID FK → languages.id | **Phase 1で追加** |
| tag_id | UUID FK → tags.id | 紐付けスキル |
| title | VARCHAR | |
| description | TEXT | 問題文 |
| initial_code | TEXT | エディタ初期表示コード |
| solution | TEXT | 模範解答（管理者のみ参照可） |
| judgment_type | ENUM | `STDOUT`（出力Diff比較）/ `TESTCASE`（assert検証）。Phase 2以降: `UNITTEST` / Phase 4〜: `EXCEL_DRIVEN` / `UI_TEST` |
| test_cases | JSONB | `[{input, expected_output}]` の配列。TESTCASE モード時は全件検証 |
| expected_output | TEXT | STDOUTモード時の期待標準出力 |
| efficiency_threshold_ms | INTEGER | 実行効率ボーナスの基準時間（ms）|
| efficiency_threshold_kb | INTEGER | 実行効率ボーナスの基準メモリ（KB）|
| difficulty | SMALLINT | 1=入門 / 2=中級 / 3=応用 |
| status | ENUM | AUTO_GENERATED / APPROVED / ARCHIVED |
| source | ENUM | AI_GENERATED / MANUAL |
| created_at | TIMESTAMP | |

---

### `submissions`（既存・変更なし）
ユーザーの提出履歴。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| user_id | UUID FK → users.id | |
| problem_id | UUID FK → problems.id | |
| code | TEXT | 提出コード |
| result | ENUM | PASS / FAIL / ERROR / TIMEOUT |
| exp_earned | INTEGER | 獲得EXP（0〜30） |
| runtime_ms | INTEGER | 実行時間（ms） |
| memory_kb | INTEGER | メモリ使用量（KB） |
| hint_count | INTEGER | ヒント要求回数 |
| submitted_at | TIMESTAMP | |

---

### `users`（既存・変更なし）
| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| rank | VARCHAR | 例: "シルバーコーダー" |
| total_exp | INTEGER | 累計EXP |
| streak_days | INTEGER | 連続学習日数 |
| created_at | TIMESTAMP | |

---

### `user_quotas`（既存・変更なし）
AIリクエストのレート制限管理。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| user_id | UUID FK → users.id | |
| daily_count | INTEGER | 当日のAIリクエスト数 |
| limit | INTEGER | ランク別上限 |
| reset_at | TIMESTAMP | 翌日0時 |

---

### `ai_skill_suggestions`（新規 / Phase 2用・テーブルのみ定義）
AIが「このスキルは全言語共通では？」と提案するレコード。
管理者が承認すると `tags.template_id` が一括設定される。

| カラム | 型 | 説明 |
| :--- | :--- | :--- |
| id | UUID PK | |
| template_id | UUID FK → skill_templates.id | 対象テンプレート |
| suggested_tag_ids | UUID[] | 共通化を提案するtag idのリスト |
| reason | TEXT | AIによる根拠テキスト |
| status | ENUM | PENDING / APPROVED / REJECTED |
| created_at | TIMESTAMP | |

---

## 3. テーブル間のリレーション概要

```
languages
  └─ tags (language_id)              ← 言語ごとに独立したスキルノード
       ├─ tag_dependencies            ← スキル間の解放条件（同一言語内）
       ├─ problems (tag_id)           ← スキルに紐づく問題
       │    └─ submissions            ← ユーザーの提出履歴
       └─ user_tag_progress           ← ユーザーのスキル習熟度

skill_templates (Phase 2〜)
  ├─ tags.template_id                ← 共通概念とスキルインスタンスの紐付け
  └─ ai_skill_suggestions            ← AI提案レコード
```

---

## 4. 主要APIエンドポイント (v1)

### 生徒側
| メソッド | パス | 説明 |
| :--- | :--- | :--- |
| GET | `/me/dashboard` | ダッシュボード情報（EXP・ストリーク・次の1問） |
| GET | `/languages` | 有効な言語一覧 |
| GET | `/skill-tree?language_id=` | 指定言語のスキルツリー全体 |
| POST | `/execute` | コード実行（非同期） |
| GET | `/tasks/{task_id}` | 非同期タスクの進捗・結果取得 |
| POST | `/review` | PRレビュー要求（AIシニアエンジニア） |
| POST | `/chat` | AIヒント要求 |

### 管理者側
| メソッド | パス | 説明 |
| :--- | :--- | :--- |
| GET/POST | `/admin/languages` | 言語一覧・追加 |
| PATCH | `/admin/languages/{id}` | 言語の有効化・設定変更 |
| GET/POST | `/admin/tags?language_id=` | スキル一覧・追加 |
| PATCH | `/admin/tags/{id}` | スキル設定変更 |
| DELETE | `/admin/tags/{id}` | スキル削除 |
| POST | `/admin/tag-dependencies` | 依存関係の追加 |
| GET | `/admin/problems?language_id=&tag_id=&status=` | 問題一覧（フィルタ付き） |
| POST | `/admin/problems` | 問題の手動追加 |
| PATCH | `/admin/problems/{id}` | 問題の編集・承認・アーカイブ |
| POST | `/admin/problems/{id}/test` | 模範解答のテスト実行 |
| POST | `/admin/problems/generate` | AI一括生成キューに追加 |

### Phase 2追加予定
| メソッド | パス | 説明 |
| :--- | :--- | :--- |
| GET | `/admin/skill-suggestions` | AIの共通スキル提案一覧 |
| POST | `/admin/skill-suggestions/{id}/approve` | 提案を承認・一括展開 |
| POST | `/admin/skill-suggestions/{id}/reject` | 提案を却下 |
