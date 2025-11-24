import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { deleteUsageLog } from './actions'

export default async function AdminUsageLogsPage() {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        redirect('/')
    }

    // Get all usage logs
    const usageLogs = await prisma.usageLog.findMany({
        include: {
            user: true,
            reagent: true,
        },
        orderBy: {
            date: 'desc',
        },
    })

    return (
        <div className="content-wrapper py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">利用料金管理</h1>
                <p className="text-gray-600">試薬利用履歴の確認・編集・削除ができます</p>
            </div>

            {usageLogs.length === 0 ? (
                <Card className="card-elevated">
                    <CardContent className="py-12">
                        <div className="text-center text-gray-500">
                            <p>利用履歴はありません</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {usageLogs.map((log) => (
                        <Card key={log.id} className="card-elevated">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="grid grid-cols-5 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-600">日付</p>
                                                <p className="font-medium">
                                                    {new Date(log.date).toLocaleDateString('ja-JP')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">利用者</p>
                                                <p className="font-medium">{log.user.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">試薬名</p>
                                                <p className="font-medium">{log.reagent.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">数量</p>
                                                <p className="font-medium">{log.quantity}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">料金</p>
                                                <p className="font-medium text-blue-600">
                                                    ¥{log.totalCost.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <Link href={`/admin/usage-logs/${log.id}/edit`}>
                                            <Button variant="outline" size="sm">
                                                <Edit className="h-4 w-4 mr-1" />
                                                編集
                                            </Button>
                                        </Link>
                                        <form action={deleteUsageLog.bind(null, log.id)}>
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                削除
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
