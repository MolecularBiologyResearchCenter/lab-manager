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

## 第一段階の計測仕様

既存の `console.info` JSON出力を再利用し、監査ログ・DBスキーマ・画面表示は変更しません。

| 対象 | operation | method / path（固定の処理入口） |
| --- | --- | --- |
| ログインServer Action | `auth.login` | POST /login |
| 利用者ダッシュボードデータ取得 | `dashboard.user` | POST / |
| 予約一覧・カレンダー共通のサーバーページ | `page.reservations` | GET /reservations |
| 機器一覧Server Action | `equipment.list` | POST /reservations |
| 管理者ダッシュボードのサーバーページ | `page.admin.dashboard` | GET /admin |
| 管理者ダッシュボードの通知取得API | `api.admin.notifications` | GET /api/admin/notifications |

各記録は `requestId`, `method`, `path`, `status`, `durationMs`, `result` を含みます。
Server Actionとサーバーページの `statusKind=server-processing` は処理結果のステータスであり、Next.jsが後で返すHTTPステータスを保証しません。成功200、ログイン入力不足400、認証失敗・利用制限401、試行制限429、例外500、ページの認証リダイレクト307です。通知APIは `statusKind=http-response` で実際のレスポンスステータスを記録します。

`method` / `path` は固定の入口ラベルで、動的URLやクエリ文字列を読みません。機器一覧をページ内から直接呼ぶ場合もServer Actionの入口ラベルを使います。`requestId` は既存の監査コンテキストのIDを再利用し、コンテキスト外ではUUIDを生成します（通知APIは既存レスポンスID）。ログ自体は監査ログと別出力です。ページと内部Actionは別記録なので、時間を合算しないでください。

`durationMs` はサーバー関数の処理時間です。ブラウザー描画、通信時間、後続のReactレンダリングは含みません。`stages.prismaQuery` は囲んだDB処理の待ち時間（並列処理は経過時間）であり、DBエンジン時間の合計ではありません。ログインは利用者検索を計測し、スロットル・監査書き込み等は総時間に含みます。既存の `lab_manager_prisma_query` はクエリ単体の実行時間のみで、requestIdとの関連付けはありません。

性能ログにはリクエスト本文、ヘッダー、Cookie、入力値、戻り値、例外本文、SQL・パラメータを渡しません。追加メタデータも許可リスト方式で、任意の文字列（errorCodeを含む）は出力しません。パスワード、メール、トークン、Client Secret、印鑑画像の混入を防ぎます。ログ出力の失敗は処理結果に影響させません。

次段階では同一期間・同一環境のログから成功処理をoperationごとに集計し、件数が十分ある処理のp95を比較して1件選びます。既存集計ツールの並び順は最大値なので、p95列で比較してください。選んだ処理のDB待ち時間を確認し、DBが主因ならクエリ計画・取得件数を調査して改善前後のp95を同条件で比較します。この段階ではクエリやインデックスを変更していません。
