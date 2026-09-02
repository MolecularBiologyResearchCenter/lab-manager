import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { deleteUsageLog } from './actions'
import AdminYearSelect from '@/components/AdminYearSelect'

export default async function AdminUsageLogsPage(props: { searchParams: Promise<{ month?: string; year?: string }> }) {
    const searchParams = await props.searchParams
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        redirect('/')
    }

    // Date Filtering Logic
    const now = new Date()
    const currentYear = now.getFullYear()

    // Determine display year (for buttons)
    let displayYear = currentYear
    if (searchParams.year) {
        displayYear = parseInt(searchParams.year)
    } else if (searchParams.month) {
        const [y] = searchParams.month.split('-')
        if (y) displayYear = parseInt(y)
    }

    // Determine target date (for data)
    let targetDate = now
    let isMonthSelected = false
    if (searchParams.month) {
        const [year, month] = searchParams.month.split('-').map(Number)
        if (!isNaN(year) && !isNaN(month)) {
            targetDate = new Date(year, month - 1, 1)
            isMonthSelected = true
        }
    } else if (searchParams.year) {
        const y = parseInt(searchParams.year)
        // If year is selected but no month, we default to the first month of that year?
        // Or should we show the WHOLE year?
        // Admin dashboard shows specific month data.
        // Let's default to the current month if it's the current year, otherwise January of that year.
        if (y === currentYear) {
            targetDate = now
        } else {
            targetDate = new Date(y, 0, 1)
        }
    }

    // If month is specifically selected, show that month.
    // If only year is selected (or default), logic above sets a targetDate.
    // We will show usage logs for the "target month" defined by targetDate.

    // However, the user might want to see ALL logs for the year if no month is selected? 
    // The previous request said "like the admin dashboard". Admin dashboard shows specific month data.
    // So we will stick to showing specific month data.

    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1)

    // Generate months for the display year (Jan - Dec)
    const months = []
    for (let i = 1; i <= 12; i++) {
        const value = `${displayYear}-${String(i).padStart(2, '0')}`
        const label = `${displayYear}年${i}月`
        months.push({ value, label })
    }

    // Get filtered usage logs
    const usageLogs = await prisma.usageLog.findMany({
        where: {
            date: {
                gte: startDate,
                lt: endDate,
            },
        },
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

            <div className="mb-8 space-y-3">
                {/* Year Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">年選択:</span>
                    <AdminYearSelect currentYear={currentYear} />
                </div>

                {/* Month Selector */}
                <div className="admin-month-picker mx-0">
                    {months.map((m) => {
                        // Active if it matches the targetDate
                        const isTarget = targetDate.getFullYear() === parseInt(m.value.split('-')[0]) &&
                            (targetDate.getMonth() + 1) === parseInt(m.value.split('-')[1])

                        return (
                            <Link key={m.value} href={`/admin/usage-logs?month=${m.value}`} className="block">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`admin-month-button ${isTarget ? 'admin-month-button-active' : ''}`}
                                >
                                    {parseInt(m.value.split('-')[1])}月
                                </Button>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {usageLogs.length === 0 ? (
                <Card className="card-elevated">
                    <CardContent className="py-12">
                        <div className="text-center text-gray-500">
                            <p>{targetDate.getFullYear()}年{targetDate.getMonth() + 1}月の利用履歴はありません</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-end mb-2">
                        <p className="text-sm text-gray-600">
                            {targetDate.getFullYear()}年{targetDate.getMonth() + 1}月: {usageLogs.length}件の記録
                        </p>
                    </div>
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
