import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTokyoDateTime } from '@/lib/date-format'

const roleLabels: Record<string, string> = {
    ADMIN: '管理者',
    CENTER_DIRECTOR: 'センター長',
    USER: '利用者',
}

const actionLabels: Record<string, string> = {
    'invoice.pdf_download': '署名付きPDF取得',
}

const actionOptions = [
    ['invoice.pdf_download', '署名付きPDF取得'],
]

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams?: Promise<{ action?: string }>
}) {
    await requireAdmin()
    const action = (await searchParams)?.action
    const selectedAction = actionOptions.some(([value]) => value === action) ? action : undefined

    let logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>> = []
    let databaseMessage: string | null = null

    try {
        logs = await prisma.auditLog.findMany({
            where: selectedAction ? { action: selectedAction } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 200,
        })
    } catch (error) {
        console.error('監査ログの読み込みに失敗しました。', error)
        databaseMessage = '監査ログ用のデータベース設定がまだ反映されていません。管理者に npx prisma db push の実行を依頼してください。'
    }

    return (
        <main className="app-page page-container">
            <div className="content-wrapper">
                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle>監査ログ</CardTitle>
                        <p className="text-sm text-slate-500">誰が、いつ、どの操作を行ったかを最新200件まで表示します。</p>
                        <form method="get" className="flex items-center gap-2 pt-2">
                            <label htmlFor="audit-action" className="text-sm font-medium text-slate-700">操作の絞り込み</label>
                            <select id="audit-action" name="action" defaultValue={selectedAction ?? ''} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                <option value="">すべて</option>
                                {actionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <button type="submit" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white">適用</button>
                        </form>
                    </CardHeader>
                    <CardContent>
                        {databaseMessage && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{databaseMessage}</p>}
                        <div className="max-h-[440px] overflow-auto rounded-lg">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead>
                                    <tr className="border-b bg-white text-left text-slate-600">
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">日時</th>
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">実行者</th>
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">権限</th>
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">操作</th>
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">対象</th>
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">内容</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0">
                                            <td className="whitespace-nowrap px-3 py-3">{formatTokyoDateTime(log.createdAt)}</td>
                                            <td className="px-3 py-3">{log.actorName}</td>
                                            <td className="px-3 py-3">{roleLabels[log.actorRole] ?? log.actorRole}</td>
                                            <td className="px-3 py-3">{actionLabels[log.action] ?? log.action}</td>
                                            <td className="px-3 py-3">{log.targetLabel || log.targetType}</td>
                                            <td className="px-3 py-3">{log.summary}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {logs.length === 0 && <p className="py-8 text-center text-slate-500">監査ログはまだありません。</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
