# DB接続地域・Vercel実行リージョン確認記録

## 調査結果

| 項目 | 結果 | 根拠・確認方法 |
| --- | --- | --- |
| アプリ構成 | Next.js 15 App Router | `package.json`、`src/app` |
| ORM・DB接続 | Prisma 5 / PostgreSQL互換DB | `prisma/schema.prisma` の datasource |
| DB提供元 | 未確認 | 接続先の実値は本番環境変数にあり、リポジトリ内には安全に出力できる情報がない |
| DBリージョン | 未確認 | `DATABASE_URL` のホストや管理サービスの設定画面を、値をマスクした状態で確認する必要がある |
| Vercel実行リージョン | 本番値は未確認 | Vercel実行時の `VERCEL_REGION` をFunction Logsで確認する必要がある |
| Vercelのコード設定 | 東京 `hnd1` を指定 | ルートレイアウトの `preferredRegion` |
| 実行ランタイム | Node.js | ルートレイアウトの `runtime`。PrismaをEdgeへ変更していない |
| `vercel.json` | なし | 既存のVercel設定ファイルを上書きしていない |

本変更では、データベースの移転、migration、環境変数の変更、本番データの変更は行わない。

## 実装内容

`src/app/layout.tsx` に次を追加した。

```ts
export const runtime = "nodejs"
export const preferredRegion = "hnd1"
```

ルートレイアウトで指定するため、配下のページ、Server Action、Route Handlerはこのリージョン設定を継承する。PDF生成・押印APIは既存のNode.js指定を維持する。

Vercelの契約プランやプロジェクト設定がリージョン指定を制限する場合、設定は無理に変更せず、Vercel DashboardのProject Settingsで利用可能なFunction Regionを確認する。Previewデプロイで確認してからProductionへ反映する。

## DB提供元・リージョンの安全な確認手順

1. Vercel Dashboardで対象プロジェクトの **Settings → Environment Variables** を開く。
2. `DATABASE_URL` の値は表示・コピー・共有せず、ホスト名だけを管理者の安全な記録へ控える。ユーザー名、パスワード、ポート、DB名、クエリ文字列はマスクする。
3. Supabaseを利用している場合は、Supabase Dashboardの対象Projectの **Project Settings → General** でRegionを確認する。異なるサービスの場合は、そのサービスのProject/Database SettingsでRegionを確認する。
4. DBリージョンが確認できない場合は、推測せず「未確認」と記録する。
5. Vercel PreviewのFunction Logsで `region` と `dbRegion` を確認する。アプリの性能ログは秘密情報・SQL本文・SQLパラメータを記録しない。

## 計測方法

アプリは主要な処理について、次の安全な構造化ログを出力する。

- `requestId`
- `operation`
- `durationMs`
- `stages`（認証、DB接続、Prisma、外部API、PDF、アプリ、レスポンス）
- `region`（`VERCEL_REGION`、未設定時は `local`）
- `dbRegion`（`SUPABASE_REGION` または `DB_REGION`、未設定時は `unknown`）

Vercel Function LogsをJSON Linesで保存し、次でp50/p95/最大値を集計する。

```bash
npm run performance:summary -- ./vercel-function-logs.jsonl
```

ログの取得権限や対象期間がない状態では、本番の変更前後の処理時間を推測してはいけない。今回のリポジトリ作業では本番ログを取得していないため、変更前後の実測値は未計測である。

### 計測対象

| 処理 | operation |
| --- | --- |
| ログイン | `auth.login` |
| トップ/利用者ホーム | `dashboard.user` |
| 予約一覧・予約操作 | `page.reservations`, `reservation.*` |
| 請求書一覧・作成 | `page.admin.invoices`, `invoice.generate` |
| 請求書PDF | `api.invoice.pdf`, `api.invoice.seal` |
| 監査ログ・管理通知 | 該当する `api.*` operation |

## Preview確認チェックリスト

- [ ] PreviewのFunction Logsで `region=hnd1` を確認
- [ ] `dbRegion` が実際のDBリージョンと一致するか確認（不明なら未確認）
- [ ] ログイン・トップ画面
- [ ] 予約一覧・予約作成
- [ ] 請求書一覧・請求書PDF
- [ ] 押印済みPDFの取得
- [ ] 監査ログの閲覧
- [ ] Microsoft Graph連携は実データを変更しないテスト条件で確認
- [ ] ログにパスワード、トークン、Client Secret、電子印画像、SQL本文、不要な個人情報がないこと

## 変更前後の比較記録

| 処理 | 変更前 p50/p95/max | 変更後 p50/p95/max | 判定 |
| --- | --- | --- | --- |
| ログイン | 未計測 | 未計測 | 本番/Previewログ取得後に記録 |
| トップ画面 | 未計測 | 未計測 | 本番/Previewログ取得後に記録 |
| 予約一覧 | 未計測 | 未計測 | 本番/Previewログ取得後に記録 |
| 予約作成 | 未計測 | 未計測 | 本番/Previewログ取得後に記録 |
| 請求書一覧 | 未計測 | 未計測 | 本番/Previewログ取得後に記録 |
| 請求書PDF | 未計測 | 未計測 | 本番/Previewログ取得後に記録 |

## 未確認事項・手動操作

- 本番のDB提供元、DBリージョン、接続プール方式はVercel/Supabase等の管理画面で確認が必要。
- `DATABASE_URL` と `DIRECT_URL` の実値は、チャット、PR、ログへ貼り付けない。
- Vercel DashboardでPreviewデプロイのFunction Regionが `hnd1` と表示されることを確認する。
- 契約プランや組織ポリシーで `hnd1` が利用できない場合は、Vercel管理者にFunction Regionの利用可否を確認する。
- DBが東京以外の場合、実行リージョンだけを東京に寄せても改善しない可能性がある。DB移転は別途、バックアップ・停止時間・接続文字列変更を含む計画として扱う。

## 安全性

- 本番DBのスキーマ、データ、接続先は変更していない。
- PrismaをEdge Runtimeへ変更していない。
- 秘密情報、個人情報、電子印画像は計測ログに含めない。
- 既存の認証、予約、請求書PDF、押印、監査ログ、年間登録料、Microsoft Graph連携のコードパスはリージョン設定以外変更していない。
