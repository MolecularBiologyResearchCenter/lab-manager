import { prisma } from '@/lib/prisma'
import { requireAdminOrCenterDirector } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTokyoDateTime } from '@/lib/date-format'
import { performanceTrace } from '@/lib/performance'
import { recordAuditLog } from '@/lib/audit'

const roleLabels: Record<string, string> = {
    ADMIN: '管理者',
    CENTER_DIRECTOR: 'センター長',
    USER: '利用者',
}

const actionLabels: Record<string, string> = {
    'invoice.pdf_download': '署名付きPDF取得',
}

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams?: Promise<{ action?: string; result?: string; actorId?: string }>
}) {
    const trace = performanceTrace('page.admin.audit-logs')
    const actor = await trace.measure('auth', requireAdminOrCenterDirector)
    const params = await searchParams
    const actionQuery = params?.action?.trim().slice(0, 100) || undefined
    const result = params?.result === 'success' || params?.result === 'failure' || params?.result === 'pending' ? params.result : undefined
    const actorId = params?.actorId?.trim().slice(0, 100) || undefined

    let logs: Array<{
        id: string
        createdAt: Date
        actorName: string
        actorId: string | null
        actorRole: string
        action: string
        targetType: string
        targetId: string | null
        targetLabel: string | null
        summary: string
        requestId: string
        result: string
        errorCode: string | null
    }> = []
    let databaseMessage: string | null = null

    try {
        logs = await trace.measure('prismaQuery', () => prisma.auditLog.findMany({
            where: {
                ...(actionQuery ? { action: { contains: actionQuery } } : {}),
                ...(result ? { result } : {}),
                ...(actorId ? { actorId } : {}),
            },
            select: {
                id: true,
                createdAt: true,
                actorName: true,
                actorId: true,
                actorRole: true,
                action: true,
                targetType: true,
                targetId: true,
                targetLabel: true,
                summary: true,
                requestId: true,
                result: true,
                errorCode: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        }))
        await recordAuditLog({ actor, action: 'AUDIT_LOG_VIEW', targetType: 'AuditLog', summary: '監査ログを閲覧しました。', requestId: trace.requestId })
        trace.finish()
    } catch {
        await recordAuditLog({ actor, action: 'AUDIT_LOG_VIEW', targetType: 'AuditLog', summary: '監査ログを取得できませんでした。', requestId: trace.requestId, result: 'failure', errorCode: 'AUDIT_LOG_READ_FAILED' })
        trace.finish('failure', { errorCode: 'AUDIT_LOG_READ_FAILED' })
        databaseMessage = '監査ログ用のデータベース設定がまだ反映されていません。管理者に npx prisma db push の実行を依頼してください。'
    }

    return (
        <main className="app-page page-container">
            <div className="content-wrapper">
                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle>監査ログ</CardTitle>
                        <p className="text-sm text-slate-500">実行者の氏名・ユーザーID、実行時の権限、日時（日本時間）、操作、結果を最新200件まで表示します。</p>
                        <form method="get" className="flex items-center gap-2 pt-2">
                            <label htmlFor="audit-action" className="text-sm font-medium text-slate-700">操作</label>
                            <input id="audit-action" name="action" defaultValue={actionQuery ?? ''} placeholder="操作名" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            <select name="result" defaultValue={result ?? ''} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="結果の絞り込み">
                                <option value="">結果：すべて</option>
                                <option value="success">成功</option>
                                <option value="failure">失敗</option>
                                <option value="pending">保留</option>
                            </select>
                            <input name="actorId" defaultValue={actorId ?? ''} placeholder="実行者ユーザーID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">結果</th>
                                        <th className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold">requestId</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0">
                                            <td className="whitespace-nowrap px-3 py-3">{formatTokyoDateTime(log.createdAt)}</td>
                                            <td className="px-3 py-3 text-xs">{log.actorName}<div className="font-mono text-slate-500">{log.actorId ?? '未認証・削除済み'}</div></td>
                                            <td className="px-3 py-3">{roleLabels[log.actorRole] ?? log.actorRole}</td>
                                            <td className="px-3 py-3">{actionLabels[log.action] ?? log.action}</td>
                                            <td className="px-3 py-3 font-mono text-xs">{log.targetType}{log.targetId ? `:${log.targetId}` : ''}</td>
                                            <td className="px-3 py-3">{log.summary}</td>
                                            <td className="px-3 py-3">{log.result === 'failure' ? '失敗' : log.result === 'pending' ? '保留' : '成功'}{log.errorCode ? `（${log.errorCode}）` : ''}</td>
                                            <td className="px-3 py-3 font-mono text-xs">{log.requestId}</td>
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
