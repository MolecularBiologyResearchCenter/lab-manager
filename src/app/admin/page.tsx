import { prisma } from '@/lib/prisma'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import AdminYearSelect from '@/components/AdminYearSelect'

export default async function AdminPage({ searchParams }: { searchParams: { month?: string; year?: string } }) {
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
    if (searchParams.month) {
        const [year, month] = searchParams.month.split('-').map(Number)
        if (!isNaN(year) && !isNaN(month)) {
            targetDate = new Date(year, month - 1, 1)
        }
    } else if (searchParams.year) {
        // If year is selected but no month, default to Jan of that year (unless it's current year, then now)
        const y = parseInt(searchParams.year)
        if (y === currentYear) {
            targetDate = now
        } else {
            targetDate = new Date(y, 0, 1)
        }
    }

    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1)

    // Generate months for the display year (Jan - Dec)
    const months = []
    for (let i = 1; i <= 12; i++) {
        const value = `${displayYear}-${String(i).padStart(2, '0')}`
        const label = `${displayYear}年${i}月`
        months.push({ value, label })
    }

    // Fetch usage logs filtered by date
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

    // Fetch reservations filtered by date
    const reservations = await prisma.reservation.findMany({
        where: {
            startTime: {
                gte: startDate,
                lt: endDate,
            },
        },
        include: {
            user: true,
            equipment: true,
        },
        orderBy: {
            startTime: 'desc',
        },
    })

    // Calculate billing per user
    const billingByUser: Record<string, number> = {}
    usageLogs.forEach(log => {
        const userName = log.user.name
        billingByUser[userName] = (billingByUser[userName] || 0) + log.totalCost
    })

    return (
        <div className="content-wrapper py-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
            </div>

            <div className="space-y-4">
                {/* Year Selector */}
                <div className="flex items-center gap-2">
                    <AdminYearSelect currentYear={currentYear} />
                </div>

                {/* Month Selector */}
                <div className="flex flex-wrap gap-2">
                    {months.map((m) => {
                        // Active if it matches the targetDate
                        const isTarget = targetDate.getFullYear() === parseInt(m.value.split('-')[0]) &&
                            (targetDate.getMonth() + 1) === parseInt(m.value.split('-')[1])

                        return (
                            <Link key={m.value} href={`/admin?month=${m.value}`}>
                                <Button
                                    variant={isTarget ? 'default' : 'outline'}
                                    size="sm"
                                >
                                    {m.label}
                                </Button>
                            </Link>
                        )
                    })}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>請求書管理</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 mb-4">
                            4ヶ月ごとの請求書を一括生成・管理
                        </p>
                        <a href="/admin/invoices">
                            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                請求書管理へ
                            </button>
                        </a>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>利用料金管理</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 mb-4">
                            試薬利用履歴の編集・削除
                        </p>
                        <a href="/admin/usage-logs">
                            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                利用料金管理へ
                            </button>
                        </a>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>月次請求サマリー</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>利用者</TableHead>
                                    <TableHead className="text-right">合計金額</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(billingByUser).map(([user, cost]) => (
                                    <TableRow key={user}>
                                        <TableCell>{user}</TableCell>
                                        <TableCell className="text-right">¥{cost.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>利用者管理</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-600 mb-4">
                        登録ユーザーの一覧確認
                    </p>
                    <a href="/admin/users">
                        <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            利用者一覧へ
                        </button>
                    </a>
                </CardContent>
            </Card>

            <Card style={{ backgroundColor: 'white' }}>
                <CardHeader>
                    <CardTitle>有料サービスログ</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>日時</TableHead>
                                <TableHead>利用者</TableHead>
                                <TableHead>試薬名</TableHead>
                                <TableHead>数量</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usageLogs.map((log, index) => (
                                <TableRow key={log.id} style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                    <TableCell>{log.date.toLocaleDateString('ja-JP')}</TableCell>
                                    <TableCell>{log.user.name}</TableCell>
                                    <TableCell>{log.reagent.name}</TableCell>
                                    <TableCell>{log.quantity}</TableCell>
                                    <TableCell className="text-right">¥{log.totalCost.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card style={{ backgroundColor: 'white' }}>
                <CardHeader>
                    <CardTitle>予約履歴</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>日付</TableHead>
                                <TableHead>利用者</TableHead>
                                <TableHead>機器名</TableHead>
                                <TableHead>時間</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reservations.map((res, index) => (
                                <TableRow key={res.id} style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                    <TableCell>{res.startTime.toLocaleDateString('ja-JP')}</TableCell>
                                    <TableCell>{res.user.name}</TableCell>
                                    <TableCell>{res.equipment.name}</TableCell>
                                    <TableCell>
                                        {res.startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - {res.endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
