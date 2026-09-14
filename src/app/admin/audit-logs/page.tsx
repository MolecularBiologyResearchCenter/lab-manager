import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const roleLabels: Record<string, string> = {
    ADMIN: '管理者',
    CENTER_DIRECTOR: 'センター長',
    USER: '利用者',
}

export default async function AuditLogsPage() {
    await requireAdmin()

    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
    })

    return (
        <main className="app-page page-container">
            <div className="content-wrapper">
                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle>監査ログ</CardTitle>
                        <p className="text-sm text-slate-500">誰が、いつ、どの操作を行ったかを最新200件まで表示します。</p>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead>
                                    <tr className="border-b text-left text-slate-600">
                                        <th className="px-3 py-3 font-semibold">日時</th>
                                        <th className="px-3 py-3 font-semibold">実行者</th>
                                        <th className="px-3 py-3 font-semibold">権限</th>
                                        <th className="px-3 py-3 font-semibold">操作</th>
                                        <th className="px-3 py-3 font-semibold">対象</th>
                                        <th className="px-3 py-3 font-semibold">内容</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0">
                                            <td className="whitespace-nowrap px-3 py-3">{log.createdAt.toLocaleString('ja-JP')}</td>
                                            <td className="px-3 py-3">{log.actorName}</td>
                                            <td className="px-3 py-3">{roleLabels[log.actorRole] ?? log.actorRole}</td>
                                            <td className="px-3 py-3">{log.action}</td>
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
