# Phase 3 実装ドキュメント

## 概要
Phase 3では、DAO貢献度測定Botの運用機能を実装しました。これには定期実行機能、評価結果確認機能、NFT用データ出力機能が含まれます。

## 実装した機能

### 1. 定期実行機能（SchedulerService）
**ファイル**: `src/services/schedulerService.js`

- **機能概要**:
  - 毎日18時（JST）に自動的に評価を実行
  - node-cronを使用したスケジューリング
  - 全ギルドに対して過去30日分のメッセージを評価

- **主要メソッド**:
  - `initialize(client)`: スケジューラーの初期化
  - `runDailyEvaluation()`: 定期評価の実行
  - `postEvaluationNotification()`: 評価完了通知の投稿
  - `postDetailedResults()`: 詳細結果の投稿

- **環境変数**:
  - `CRON_SCHEDULE`: 実行スケジュール（デフォルト: '0 18 * * *'）
  - `SUMMARY_NOTIFICATION_CHANNEL_ID`: 通知チャンネルID
  - `EVALUATION_RESULT_CHANNEL_ID`: 結果投稿チャンネルID

### 2. 評価結果確認機能（/check-evaluation）
**ファイル**: `src/commands/check-evaluation.js`

- **コマンドオプション**:
  - `evaluation_id`: 特定の評価詳細を表示
  - `user`: 特定ユーザーの評価履歴を表示
  - オプションなし: 最近の評価一覧を表示

- **表示内容**:
  - 個別評価の詳細（スコア内訳、コメント、ハイライト）
  - ユーザーごとの累積スコアと評価履歴
  - 日付別の評価一覧

### 3. NFT用データ出力機能（/export-nft）
**ファイル**: `src/commands/export-nft.js` (既存)

- **機能概要**:
  - 指定期間のユーザー貢献度データをJSON形式でエクスポート
  - 管理者権限が必要
  - NFT発行に必要な全データを含む

- **出力データ**:
  - ユーザーID、スコア、ランク
  - 評価期間
  - 貢献内容の詳細とハイライト
  - スコア内訳（技術的アドバイス、問題解決など）

### 4. 手動評価トリガー（/trigger-evaluation）
**ファイル**: `src/commands/trigger-evaluation.js`

- **機能概要**:
  - 管理者が定期評価を手動で実行可能
  - テストやデバッグ用途
  - 通常の定期評価と同じ処理を実行

## 設定方法

### 1. 環境変数の設定
`.env`ファイルに以下を追加：

```env
# 評価結果投稿チャンネル
EVALUATION_RESULT_CHANNEL_ID=your_result_channel_id

# 完了通知チャンネル
SUMMARY_NOTIFICATION_CHANNEL_ID=your_notification_channel_id

# 除外チャンネル（カンマ区切り）
EXCLUDED_CHANNEL_IDS=channel1,channel2,channel3

# スケジュール設定（デフォルト: 毎日18時）
CRON_SCHEDULE=0 18 * * *
```

### 2. コマンドのデプロイ
新しいコマンドをDiscordに登録：

```bash
npm run deploy-commands
```

### 3. Botの起動
通常通りBotを起動すると、スケジューラーが自動的に開始されます：

```bash
npm start
```

## 使用方法

### 定期評価の確認
1. 毎日18時に自動実行
2. 完了通知が`SUMMARY_NOTIFICATION_CHANNEL_ID`に投稿される
3. 詳細結果が`EVALUATION_RESULT_CHANNEL_ID`に投稿される

### 評価結果の確認
```
# 最近の評価一覧
/check-evaluation

# 特定の評価詳細
/check-evaluation evaluation_id:abc123

# ユーザーの評価履歴
/check-evaluation user:@username
```

### NFTデータのエクスポート
```
# 過去90日分（デフォルト）
/export-nft

# 過去30日分
/export-nft days:30
```

### 手動評価の実行（管理者のみ）
```
/trigger-evaluation
```

## 注意事項

1. **API制限**: Claude APIの利用制限に注意。大量のメッセージがある場合は処理に時間がかかります。

2. **除外チャンネル**: プライベートな会話や管理用チャンネルは`EXCLUDED_CHANNEL_IDS`で除外してください。

3. **タイムゾーン**: スケジューラーは日本時間（JST）で動作します。

4. **権限設定**: Botには以下の権限が必要です：
   - メッセージの読み取り
   - メッセージの送信
   - ファイルの添付
   - メンションの使用

## トラブルシューティング

### 定期評価が実行されない
- ログで`Scheduler initialized`が表示されているか確認
- `CRON_SCHEDULE`の形式が正しいか確認
- Botが正常に起動しているか確認

### 評価結果が投稿されない
- チャンネルIDが正しく設定されているか確認
- BotがチャンネルにアクセスできるかYa確認
- ログでエラーが出ていないか確認

### NFTエクスポートが失敗する
- 管理者権限があるか確認
- Firestoreにデータが保存されているか確認
- 指定期間内に評価データが存在するか確認