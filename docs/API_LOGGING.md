# Claude API ログ機能

## 概要
このボットは、Claude APIへのすべてのリクエストとレスポンスをFirestoreに記録する機能を備えています。これにより、API使用状況の監視、コスト管理、デバッグが容易になります。

## 機能詳細

### 1. 自動ログ記録
Claude APIへのすべての呼び出しが自動的に記録されます：

**記録される情報:**
- リクエスト内容（プロンプト、システムプロンプト、パラメータ）
- レスポンス内容（生成されたテキスト、停止理由）
- トークン使用量（入力/出力/合計）
- 実行時間
- エラー情報（発生した場合）
- メタデータ（スレッドID、チャンネル名など）
- タイムスタンプ

### 2. ログタイプ
以下のタイプのAPIコールが記録されます：
- `thread_evaluation`: スレッド評価
- `summary_generation`: サマリー生成

### 3. Firestoreコレクション構造
```
apiLogs/
├── {logId}/
│   ├── type: string
│   ├── model: string
│   ├── request: object
│   │   ├── prompt: string
│   │   ├── systemPrompt: string
│   │   ├── maxTokens: number
│   │   └── temperature: number
│   ├── response: object
│   │   ├── content: string
│   │   ├── stopReason: string
│   │   └── usage: object
│   ├── error: object (optional)
│   ├── duration: number (ms)
│   ├── tokenUsage: object
│   │   ├── inputTokens: number
│   │   ├── outputTokens: number
│   │   └── totalTokens: number
│   ├── metadata: object
│   ├── timestamp: timestamp
│   └── createdAt: date
```

## 設定

### 環境変数
`.env`ファイルで以下の設定が可能です：

```env
# APIログ機能の有効/無効
ENABLE_API_LOGGING=true

# ログ保持期間（日数）
API_LOG_RETENTION_DAYS=30
```

### ログ機能の無効化
APIログ機能を無効にするには：
```env
ENABLE_API_LOGGING=false
```

## コマンド

### `/api-logs` コマンド
管理者権限が必要なコマンドで、以下のアクションが実行できます：

#### 1. 統計情報の表示
```
/api-logs action:統計情報を表示 days:30
```

表示される情報：
- 総APIコール数
- 成功/失敗数
- 平均応答時間
- トークン使用量
- 推定コスト（Claude Opus基準）
- タイプ別使用回数
- 最近のエラー

#### 2. ログのエクスポート
```
/api-logs action:ログをエクスポート days:7
```

CSV形式でログをエクスポートします。以下の情報が含まれます：
- タイムスタンプ
- タイプ
- モデル
- 実行時間
- トークン使用量
- エラー情報
- メタデータ

#### 3. 古いログの削除
```
/api-logs action:古いログを削除 days:30
```

指定日数より古いログを削除します。

## コスト管理

### トークン使用量の監視
APIログから以下の情報を確認できます：
- 日次/週次/月次のトークン使用量
- タイプ別の使用傾向
- 推定コスト

### コスト計算式（Claude Opus）
- 入力トークン: $15 / 1M tokens
- 出力トークン: $75 / 1M tokens

## トラブルシューティング

### ログが記録されない場合
1. `ENABLE_API_LOGGING`が`true`に設定されているか確認
2. Firestoreの権限設定を確認
3. ログでエラーを確認

### パフォーマンスへの影響
- ログ記録は非同期で行われるため、API呼び出しのパフォーマンスへの影響は最小限
- エラーが発生してもメイン処理は継続される

### ストレージ容量
- 各ログエントリは約2-5KBを使用
- 1日100回の評価で月間約15MB
- 定期的な古いログの削除を推奨

## セキュリティ考慮事項

1. **プロンプト内容の保護**
   - APIログにはプロンプト全文が含まれる
   - 機密情報が含まれる可能性がある場合は注意

2. **アクセス制限**
   - `/api-logs`コマンドは管理者のみ使用可能
   - Firestoreのセキュリティルールで適切に保護

3. **定期的な削除**
   - 古いログは定期的に削除してセキュリティリスクを最小化

## 活用例

### 1. 月次レポート作成
```
/api-logs action:統計情報を表示 days:30
/api-logs action:ログをエクスポート days:30
```

### 2. エラー調査
```
/api-logs action:統計情報を表示 days:7
```
エラーが表示されたら、詳細をログで確認

### 3. コスト最適化
- トークン使用量の多い処理を特定
- プロンプトの最適化
- 不要な評価の削減