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

## 管理者専用の自動集計

`/admin/performance` はサーバー側で `requireAdmin()` を実行してから集計します。未認証・利用者・センター長には表示せず、管理者ヘッダーだけに「性能計測」を追加しています。監査ログ画面とは別です。

Vercelへのログ出力と同じ `durationMs` を、その出力時点で `after()` に登録した処理から自動保存します。Vercel APIでログ本文を取り出す方式ではなく、有料のLog DrainやAPIトークンを不要にする同時記録方式です。本番 (`VERCEL_ENV=production`) のみ収集し、過去のVercelログのバックフィルは行いません。保存障害時も通常処理は継続し、固定文の警告だけを出します。その場合は件数が欠けるため、この画面は性能調査用であり監査の完全性を保証しません。

専用 `PerformanceSample` テーブルには、独立した重複防止UUID、4分類の固定ラベル、日時、処理時間だけを保存します。ログ本文、requestId、ユーザーID、パス、ヘッダー、Cookie、認証情報、例外本文は保存しません。既存の業務テーブルには変更しません。自動保存の都度7日より古いレコードを削除します（無通信の間は削除が走りません）。集計は常に選択期間内だけを対象にします。

初回は `prisma/ensure-performance-samples.sql` による追加テーブル作成が必要です。既存のVercelビルドスクリプトに冪等なDDL実行を追加しています。`npm run build` はDDLを実行しません。DBに接続して本番反映する際は、適用先とビルド成功を確認してください。

件数は処理呼び出し数で、利用者数やページ閲覧数ではありません。予約・管理者分類には関連する内部Action/APIも含みます。成功・失敗の両方を集計します。p50/p95は `percentile_disc`（nearest rank）を使用し、空の分類は0件・統計値「—」にします。PostgreSQL側で集計するので、生ログや全サンプルをブラウザーへ送信しません。期間変更・再読み込み時に更新し、共有キャッシュは使いません。

## 2026-10-14 通知APIの限定改善

Vercel Logsをブラウザーで `lab_manager_performance` に絞り、15:15:17〜15:18:24 JSTに表示された成功ログを比較した。通知APIの最長記録の環境はproduction、region=hnd1、deployment=8LUdxkEAseksikTQvfD79TDeRSe4、commit=73b3eec。当該commitの通知APIと変更前のローカルファイルは一致する。他のローカル未コミット変更は保持している。

| operation | 件数 | p50 ms | p95 ms | 最大 ms |
| --- | ---: | ---: | ---: | ---: |
| auth.login | 2 | 1909.66 | 3453.25 | 3453.25 |
| dashboard.user | 1 | 1666.43 | 1666.43 | 1666.43 |
| page.reservations | 3 | 2163.42 | 2375.25 | 2375.25 |
| page.admin.dashboard | 2 | 3450.23 | 3506.42 | 3506.42 |
| api.admin.notifications | 20 | 3405.40 | 4374.73 | 4490.12 |

少数サンプルの観測結果であり、通常負荷での統計的な順位を保証しない。内部Actionとページの時間は合算しない。今回の観測でp95・最大時間とも最長の `api.admin.notifications` のみを対象にした。

最長4490.12msの内訳は認証1345.43ms、DB待ち2781.66ms。DB待ちのすべてを単一原因には帰属できないが、コード上で通知一覧取得後に独立した未読件数取得を直列実行しており、この待ち時間は重ねられる。通知補完が完了した後、この2読み取りだけをPromise.allで実行する。取得条件、50件上限、旧スキーマへのフォールバック、認証判定、監査ログの内容と書き込みタイミングは維持する。予約・請求書処理・スキーマ・UI・ログ項目は変更しない。

回帰テスト: `scripts/notification-performance-self-test.ts`。成功、旧スキーマフォールバック、401、403、DB失敗、応答へのメール非露出、並列実行、監査書き込み順を隔離した依存で確認する。実DBへアクセスしない。

同じ実API関数とPerformanceTraceを使い、一覧と件数のDB待ちをそれぞれ30msに固定して10回測定した結果:

| 隔離した模擬DB計測 | 改善前 ms | 改善後 ms |
| --- | ---: | ---: |
| durationMs p50 | 62.28 | 31.34 |
| durationMs p95 | 63.21 | 31.59 |

これは並列化による待ち時間削減の検証であり、本番4490.12msが31msになるという意味ではない。本番の改善後durationMsは未計測・未デプロイ。再現する場合は `git show 73b3eec:src/app/api/admin/notifications/route.ts > /tmp/lab-manager-notifications-baseline.ts` の後、`node --import tsx scripts/notification-performance-self-test.ts /tmp/lab-manager-notifications-baseline.ts` を実行する。

残る要因は認証のDB往復、通知補完の直列処理と利用者ごとの書き込み、監査書き込み、DB接続プール・ネットワーク待ち。dbRegionはunknownで、外部サービス待ちやDB実行計画が主因という証拠はない。本番の改善確認には同じデプロイ条件・操作・負荷でログを再取得する必要がある。
