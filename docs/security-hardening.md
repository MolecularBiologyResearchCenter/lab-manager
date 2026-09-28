# セキュリティ強化・運用確認

## 環境変数

値はGit、ログ、PR、画面共有へ出さず、VercelのProduction環境変数へ安全に設定します。

- `DATABASE_URL`: Prismaの通常接続先
- `DIRECT_URL`: Prisma migration用の直接接続先
- `MICROSOFT_TENANT_ID`: Microsoft Entra IDテナントID
- `MICROSOFT_CLIENT_ID`: Microsoft Entra IDアプリケーションID
- `MICROSOFT_CLIENT_SECRET`: Microsoft Entra IDアプリケーションのSecret（値は記録・共有しない）
- `MICROSOFT_GROUP_ID`: 同期対象として固定するMicrosoft 365グループID
- `AUTH_SECRET`: セッション署名用の強いランダム値。本番必須
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`: メール送信を有効化する場合のみ
- `VERCEL_REGION`: Vercel Functionの実行リージョン確認用
- `SUPABASE_REGION` または `DB_REGION`: DB接続先地域の計測表示用

## パスワード移行

既存DBにscrypt形式以外の値が残っている場合は、アプリ切替前に次を実行します。

```bash
npm run password:migrate
```

この処理は値を表示せず、各ユーザーのパスワードをscryptハッシュへ置換します。移行後のログイン処理は平文値を比較せず、scrypt形式以外を認証成功にしません。

## 本番反映前チェック

- Production環境変数がPreviewと分離されている
- `AUTH_SECRET`が設定され、PreviewとProductionで意図せず共有されていない
- パスワード移行の件数を管理者が確認している
- `npm run build`、`npm run lint`、セキュリティ自己テストが成功している
- Vercel Function Logsにパスワード、トークン、印鑑画像、個人情報が出ていない
