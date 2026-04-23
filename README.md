# CodeForge

「実務で自走できるエンジニア」を育成するAI駆動型プログラミング学習プラットフォーム。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| バックエンド | Python / FastAPI / Cloud Run（GCP） |
| データベース | PostgreSQL（Cloud SQL）/ Redis（Cloud Memorystore） |
| 非同期処理 | Celery + Redis |
| サンドボックス | Docker + gVisor |
| AI | Gemini（Vertex AI）/ GPT-4o（OpenAI） |
| フロントエンド | React（SPA）/ Monaco Editor |

## 起動方法

```bash
# 環境変数を設定
cp backend/.env.example backend/.env
# OPENAI_API_KEY などを編集

# 全サービスを起動
docker-compose up --build

# DBマイグレーション
docker-compose exec backend alembic upgrade head
```

アクセス先：
- フロントエンド: http://localhost:3000
- APIドキュメント: http://localhost:8000/docs

## プロジェクト構成

```
codeforge/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI エントリポイント
│   │   ├── config.py            # 設定
│   │   ├── database.py          # DB接続
│   │   ├── models/              # SQLAlchemy モデル
│   │   ├── schemas/             # Pydantic スキーマ
│   │   ├── api/                 # APIルート（auth / student / admin）
│   │   ├── services/            # ビジネスロジック
│   │   │   ├── sandbox.py       # Docker実行サンドボックス
│   │   │   ├── judgment.py      # STDOUT/TESTCASE 判定エンジン
│   │   │   ├── error_translator.py  # エラー日本語化
│   │   │   ├── exp_calculator.py    # EXP計算
│   │   │   ├── ai.py            # AI ヒント/レビュー/生成
│   │   │   └── auth.py          # JWT認証
│   │   └── workers/             # Celery タスク
│   └── alembic/                 # DBマイグレーション
├── frontend/
│   └── src/
│       ├── pages/               # ダッシュボード/ワークスペース/スキルツリー
│       ├── components/          # 共通コンポーネント
│       ├── api/                 # APIクライアント
│       ├── hooks/               # カスタムフック
│       └── types/               # TypeScript型定義
└── docker-compose.yml
```

## Phase 1 実装済み機能

- ユーザー認証（JWT）
- 言語・スキルツリー・依存関係管理
- コード実行サンドボックス（Docker + gVisor対応）
- 非同期実行フロー（Celery + ポーリング）
- STDOUT / TESTCASE 判定エンジン
- エラーの日本語化（コンパイル/実行時/タイムアウト）
- EXP計算（基本/一発正解/ノーヒント/クリーン/高効率）
- AIヒント（ソクラテスメソッド / クォータ管理）
- AIコードレビュー（GPT-4o）
- 問題承認フロー（AUTO_GENERATED → APPROVED → ARCHIVED）
- AI問題一括生成（非同期Celeryタスク）
- React フロントエンド（ダッシュボード/スキルツリー/ワークスペース）
