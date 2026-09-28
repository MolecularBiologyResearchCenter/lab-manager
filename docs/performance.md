# Lab Manager パフォーマンス計測

主要なServer Action、ページ、APIは `lab_manager_performance` の構造化ログを出力します。ログにはパスワード、トークン、氏名、メールアドレス、SQL本文、SQLパラメータを含めません。

## 確認方法

VercelのFunction LogsをJSON Linesで保存し、次を実行します。

```bash
npm run performance:summary -- ./vercel-function-logs.jsonl
```

出力は処理単位のp50、p95、最大値、件数、原因分類を遅い順に表示し、続けて認証・DB接続・Prisma・外部処理・PDF・アプリ・レスポンスの段階別集計も表示します。上位10件は処理単位の一覧の先頭10行を採用します。`region` は `VERCEL_REGION`、`dbRegion` は `SUPABASE_REGION` または `DB_REGION` を読み取ります。未設定の場合は `unknown` として、環境変数の設定漏れを確認できます。

## 計測対象と分類

| 処理 | operation | 主な分類 |
| --- | --- | --- |
| ログイン | `auth.login` | 認証 |
| 利用者ホーム | `dashboard.user` | DB/アプリ処理 |
| 管理者ダッシュボード | `page.admin.dashboard` | アプリ処理 |
| 機器予約 | `page.reservations` / `reservation.*` | DB/アプリ処理 |
| 請求書管理 | `page.admin.invoices` / `invoice.generate` | DB/アプリ処理 |
| 通知取得 | `api.admin.notifications` | アプリ処理 |
| PDF生成・取得 | `api.invoice.pdf` / `api.invoice.seal` | PDF処理 |

各APIレスポンスの `X-Request-ID` と、ログの `requestId` を照合できます。Prismaは安全なクエリ実行時間のみを `lab_manager_prisma_query` として出力します。利用者一覧、利用履歴、CSV出力、通知既読化もAPI単位のトレース対象です。

## 実施した改善

- 利用者ホーム、管理者画面、予約画面、請求書画面の独立したDB取得を並列化。
- 請求書一括生成の利用明細・既存請求書確認を全件の利用者別N+1クエリから集約クエリへ変更し、生成処理も独立利用者ごとに並列化。
- 予約作成・更新・削除、請求書一括生成にサーバー側idempotency keyを導入。
- ログイン、予約、請求書生成の送信中はボタンを無効化し、「処理中です」を中央表示。
- 期限付きidempotencyレコードを追加し、同一操作の再送を無視。

本番のp50/p95/最大値は、デプロイ後にVercel Function Logsを一定期間取得して上記スクリプトで集計します。リポジトリ内だけでは本番実行ログを推測できないため、未計測値を作成していません。
