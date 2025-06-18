# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

これは **DAO貢献度測定ボット** で、Google Gemini AIを使用してDiscordコミュニティメンバーの貢献を自動的に評価します。以下で構成されています：
- **Discord Bot** (Node.js バックエンド) - 会話を分析し、貢献スコアを生成
- **Webダッシュボード** (Next.js フロントエンド) - ランキングと貢献履歴を可視化

## 必須コマンド

### バックエンド (Discord Bot)
```bash
npm install                  # 依存関係のインストール
npm run deploy-commands      # Discordスラッシュコマンドのデプロイ（コマンド変更後に必須）
npm start                   # 本番環境で実行
npm run dev                 # 開発用（変更時に自動再起動）
npm run lint                # コード品質チェック
npm run lint:fix           # リンティングエラーの自動修正
```

### フロントエンド (ダッシュボード)
```bash
cd frontend
npm install                 # 依存関係のインストール
npm run dev                # 開発サーバー起動（デフォルト: ポート3000）
npm run build              # 本番用ビルド
npm start                  # 本番ビルドの実行
npm run lint               # コード品質チェック
```

### データベースマイグレーション
```bash
node scripts/migrateUserEvaluations.js  # ユーザー評価を最適化されたコレクションに移行
```

## アーキテクチャと主要概念

### データフロー
1. **メッセージ収集**: BotがDiscordチャンネルを監視し、メッセージを会話スレッドにグループ化
2. **AI評価**: スレッドを構造化されたプロンプトとともにGemini AIに送信してスコアリング
3. **スコア計算**: 技術的アドバイス、問題解決、実現可能性、コミュニケーション、成果物に基づいて評価
4. **データ保存**: 結果をFirestoreに保存し、ユーザースコアを`userScores`コレクションに集計
5. **可視化**: フロントエンドがNext.js APIルート経由でデータを取得・表示

### 重要なコレクション
- `evaluations`: 参加者スコアを含む個別のスレッド評価
- `userScores`: 集計されたユーザー統計（totalScore、evaluationCount、breakdown）
- `userEvaluations`: 効率的なクエリのための非正規化されたユーザー固有の評価参照
- `threads`: 評価ステータスを持つDiscord会話スレッド

### 評価システム
- **スケジュール実行**: cronジョブで毎日18:00 JSTに実行
- **時間減衰**: 古い貢献は価値が減少（λ=0.0001/日）
- **スコアカテゴリ**: 
  - 技術的アドバイス (0-25ポイント)
  - 問題解決 (0-25ポイント)
  - 実現可能性 (0-20ポイント)
  - コミュニケーション (0-20ポイント)
  - 成果物 (0-10ポイント)
  - ペナルティ（有害な行動に対する減点）

### APIエンドポイント (フロントエンド)
- `GET /api/rankings` - 総スコア上位50ユーザーを取得
- `GET /api/evaluations/user/[userId]` - ページネーション付きユーザー評価履歴を取得
- `GET /api/threads/[threadId]` - 評価付きスレッド詳細を取得

### 環境設定
バックエンドにはDiscord認証情報、Google APIキー、Firebaseサービスアカウントが必要。
フロントエンドにはFirestoreアクセス用のFirebase管理者認証情報が必要。

### パフォーマンス最適化
- `userEvaluations`コレクションは効率的なフィルタリングのためにユーザー参加をインデックス化
- 大規模データセット用のカーソルベースのページネーション
- Firestore書き込みのバッチ操作（最大400件/バッチ）

### よくある問題と解決策
- **「evaluationCountは180だが表示される評価は7件のみ」**: マイグレーションスクリプトを実行して`userEvaluations`コレクションを作成
- **Next.js 15でのAPIパラメータエラー**: ルートハンドラーでプロパティにアクセスする前にparamsをawaitする
- **Firebase FieldPathエラー**: `db`だけでなく`firebase-admin`からインポートする