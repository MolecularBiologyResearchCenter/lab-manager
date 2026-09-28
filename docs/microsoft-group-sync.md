# Microsoft 365グループ同期

## 構成

メーリングリスト登録が有効になったときだけ、Vercelのサーバー側からMicrosoft Graph v1.0へ同期します。ブラウザからGraph APIを呼び出したり、グループIDをリクエストから受け取ったりしません。

必要なProduction/Preview環境変数は次のとおりです。

- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_GROUP_ID`

Client Credentialsで取得したアクセストークンはレスポンス・監査ログ・コンソールへ出力しません。Graphアプリには対象グループへの必要最小限のApplication権限（ユーザー検索用の`User.Read.All`、メンバー追加・削除用の`GroupMember.ReadWrite.All`）を付与し、テナント管理者の同意を完了してください。

## 同期動作

- 新規登録、本人のマイページ変更、管理者の利用者情報変更でメーリングリスト設定を同期します。
- 既存メンバーへの追加、未所属メンバーの削除は成功扱いにします。
- Entra IDにユーザーが存在しない場合やGraphが一時的に失敗した場合でも、Lab Manager側の登録・設定変更は完了します。
- 同期状態は`User.microsoftGroupSyncStatus`等に保存し、失敗時は管理者通知と監査ログを作成します。
- Graph APIの一時エラーは最大3回まで再試行します。
- アカウント削除時は、対象ユーザーを削除するのではなく、グループの`members/{id}/$ref`だけを削除します。

## Preview確認

1. Vercel Previewに4つの環境変数を秘密値として設定する。
2. Entra IDアプリに必要なApplication権限と管理者同意があることを確認する。
3. テスト用大学メールアドレスで登録し、対象グループのメンバー一覧を確認する。
4. マイページで登録可/不可を切り替え、追加・削除を確認する。
5. 同じ切り替えを2回行い、重複エラーにならないことを確認する。
6. 存在しないメールアドレスではLab Manager側の操作が成功し、管理者通知に同期失敗が表示されることを確認する。

秘密値、アクセストークン、メールアドレスの詳細はPR、ログ、スクリーンショットへ記録しないでください。
