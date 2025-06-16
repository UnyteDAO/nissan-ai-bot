# DAO貢献度ダッシュボード

DAO構築支援コミュニティのメンバー貢献度を可視化するNext.jsアプリケーション。

## 機能

- **貢献度ランキング**: メンバーの総合スコアに基づくランキング表示
- **詳細スコア分析**: 各評価カテゴリの内訳を円グラフで可視化
- **ユーザー詳細ページ**: 個別ユーザーの評価履歴と詳細情報
- **スレッド詳細表示**: 評価された会話の内容と評価結果を確認
- **レスポンシブデザイン**: モバイルからデスクトップまで対応

## セットアップ

### 1. 環境変数の設定

`.env.local.example`を`.env.local`にコピーして、Firebase Admin SDKの認証情報を設定：

```bash
cp .env.local.example .env.local
```

```env
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## プロジェクト構造

```
frontend/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── rankings/      # ランキングデータ取得
│   │   ├── evaluations/   # 評価データ取得
│   │   └── threads/       # スレッド詳細取得
│   ├── user/[userId]/     # ユーザー詳細ページ
│   └── page.tsx           # ホームページ（ランキング）
├── components/            # Reactコンポーネント
│   ├── RankingCard.tsx    # ランキングカード
│   ├── ScoreChart.tsx     # スコア円グラフ
│   └── ThreadDetail.tsx   # スレッド詳細表示
├── lib/                   # ライブラリ設定
│   └── firebase-admin.ts  # Firebase Admin SDK
└── types/                 # TypeScript型定義
    └── index.ts           # 共通型定義
```

## API エンドポイント

### GET /api/rankings
- ユーザーの貢献度ランキングを取得
- レスポンス: `UserScore[]`

### GET /api/evaluations
- 評価データを取得
- クエリパラメータ:
  - `userId`: 特定ユーザーの評価をフィルタ
  - `limit`: 取得件数（デフォルト: 20）
- レスポンス: `Evaluation[]`

### GET /api/threads/[threadId]
- スレッドとその評価の詳細を取得
- レスポンス: `{ thread: Thread, evaluation: Evaluation }`

## 技術スタック

- **Next.js 14**: App Router使用
- **TypeScript**: 型安全性の確保
- **Tailwind CSS**: スタイリング
- **Firebase Admin SDK**: Firestoreデータアクセス
- **Recharts**: グラフ表示
- **Lucide React**: アイコン
- **date-fns**: 日付フォーマット

## デプロイ

Vercelへのデプロイ:

```bash
vercel
```

環境変数をVercelのダッシュボードで設定することを忘れずに。

## 開発ガイドライン

1. **型安全性**: すべての新しいコンポーネントとAPIにTypeScriptの型を定義
2. **レスポンシブ**: モバイルファーストでデザイン
3. **パフォーマンス**: 不要な再レンダリングを避ける
4. **アクセシビリティ**: 適切なARIA属性を使用

## トラブルシューティング

### Firebase接続エラー
- 環境変数が正しく設定されているか確認
- Firebase Admin SDKの認証情報が有効か確認

### ビルドエラー
- `npm run build`でビルドエラーをチェック
- TypeScriptの型エラーを修正

### データが表示されない
- Firestoreのコレクション名が正しいか確認
- APIルートが正しく動作しているか確認