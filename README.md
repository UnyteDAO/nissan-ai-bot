# DAO Contribution Measurement Bot

DAO貢献度測定ボット - Claude AIを使用してDiscordコミュニティメンバーの貢献を自動的に評価・追跡するシステム

## 概要

このプロジェクトは、DAOガバナンスをサポートするために設計された貢献度測定ボットです。Discord上での会話を分析し、Claude AI (Anthropic)を使用してメンバーの貢献を客観的に評価します。透明性の高い評価基準により、報酬分配や投票権の決定に活用できます。

## 主な機能

### 🤖 Discord Bot
- **AI駆動の評価システム**: Claude 3 Opusモデルによる高度な会話分析
- **4つの評価カテゴリ**:
  - コード貢献 (重み: 1.0)
  - ドキュメント貢献 (重み: 0.8)
  - コミュニティ貢献 (重み: 0.6)
  - イシュー管理 (重み: 0.4)
- **自動スケジューリング**: 毎日18:00 (JST)に過去30日間の貢献を自動評価
- **時間減衰式**: 古い貢献の価値を適切に減少 (λ=0.0001/日)

### 📊 Web Dashboard
- リアルタイムランキング表示
- 貢献スコアの詳細な内訳チャート
- ユーザー別の貢献履歴
- 統計情報の概要表示

### 🔧 Botコマンド
- `/evaluate` - 過去の会話を手動評価
- `/check-evaluation` - 評価結果と履歴を確認
- `/leaderboard` - トップ貢献者を表示
- `/export-nft` - NFTミント用データのエクスポート
- `/trigger-evaluation` - スケジュール評価を手動実行
- `/channels` - 除外チャンネルの管理
- `/api-logs` - API使用統計の確認

## 技術スタック

### Backend (Discord Bot)
- Node.js
- Discord.js v14
- Anthropic Claude AI SDK
- Firebase Admin SDK
- Winston (ロギング)
- node-cron (スケジューリング)

### Frontend (Dashboard)
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Recharts (データ可視化)
- Firebase Admin

## プロジェクト構成

```
/claude-code-ai-bot
├── /src              # Discord Bot バックエンド
│   ├── /bot          # Discordクライアントとイベントハンドラー
│   ├── /commands     # スラッシュコマンド実装
│   ├── /services     # コアビジネスロジック
│   ├── /models       # Firebaseデータモデル
│   ├── /config       # 設定管理
│   └── /utils        # ユーティリティ機能
│
├── /frontend         # Next.js ダッシュボード
│   ├── /app          # App RouterページとAPIルート
│   ├── /components   # Reactコンポーネント
│   ├── /types        # TypeScript型定義
│   └── /lib          # Firebase設定
│
└── /docs            # ドキュメントとログ
```

## セットアップ

### 必要な環境変数

#### Bot側 (.env)
```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_discord_guild_id
ANTHROPIC_API_KEY=your_claude_api_key
FIREBASE_SERVICE_ACCOUNT=path_to_service_account.json
```

#### Frontend側 (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

### インストールと起動

```bash
# Botのセットアップ
npm install
npm run deploy-commands  # コマンドの登録
npm start               # Botの起動

# Frontendのセットアップ
cd frontend
npm install
npm run dev             # 開発サーバーの起動
```

## 透明性とガバナンス

- すべてのAI評価基準は公開・監査可能
- API使用量とコストの追跡機能
- 詳細なロギングシステムによる評価プロセスの可視化
- 時間減衰式による公平な貢献価値の計算

## ライセンス

MIT License