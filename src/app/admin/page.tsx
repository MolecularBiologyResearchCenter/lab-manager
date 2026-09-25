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
import { CalendarDays, FileText, DollarSign, FlaskConical, Wrench, Users } from 'lucide-react'
import { getAuthenticatedUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { formatTokyoDate, formatTokyoTime } from '@/lib/date-format'
import AdminNotificationsCard from '@/components/AdminNotificationsCard'

export default async function AdminPage(props: { searchParams: Promise<{ month?: string; year?: string }> }) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) redirect('/login')
    if (currentUser.role !== 'ADMIN') redirect('/')
    const searchParams = await props.searchParams

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
            user: { select: { id: true, name: true } },
            reagent: true,
        },
        orderBy: {
            date: 'desc',
        },
    })

    // Fetch reservations filtered by date
    const reservations = await prisma.reservation.findMany({
        where: {
            status: { notIn: ['cancelled', 'rejected'] },
            startTime: {
                gte: startDate,
                lt: endDate,
            },
        },
        include: {
            user: { select: { id: true, name: true } },
            equipment: true,
        },
        orderBy: {
            startTime: 'desc',
        },
    })

    const tokyoDateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(now)
    const getTokyoPart = (type: Intl.DateTimeFormatPartTypes) => Number(tokyoDateParts.find((part) => part.type === type)?.value)
    const dashboardReservationsStart = new Date(Date.UTC(
        getTokyoPart('year'),
        getTokyoPart('month') - 1,
        getTokyoPart('day'),
        -9,
    ))
    const dashboardReservationsEnd = new Date(dashboardReservationsStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dashboardReservations = await prisma.reservation.findMany({
        where: {
            status: { notIn: ['cancelled', 'rejected'] },
            startTime: {
                gte: dashboardReservationsStart,
                lt: dashboardReservationsEnd,
            },
        },
        include: {
            user: { select: { name: true } },
            equipment: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
    })

    // Calculate billing per user
    const billingByUser: Record<string, number> = {}
    usageLogs.forEach(log => {
        const userName = log.user.name
        billingByUser[userName] = (billingByUser[userName] || 0) + log.totalCost
    })

    return (
        <div className="content-wrapper space-y-8 py-8">
            <div>
                <h1>管理者ダッシュボード</h1>
                <p className="mt-2 text-sm text-slate-500">センターの利用状況と各種設定を確認できます</p>
            </div>

            <div className="space-y-3">
                {/* Year Selector */}
                <div className="flex items-center justify-center gap-2">
                    <AdminYearSelect currentYear={currentYear} />
                </div>

                {/* Month Selector */}
                <div className="admin-month-picker">
                    {months.map((m) => {
                        // Active if it matches the targetDate
                        const isTarget = targetDate.getFullYear() === parseInt(m.value.split('-')[0]) &&
                            (targetDate.getMonth() + 1) === parseInt(m.value.split('-')[1])

                        return (
                            <Link key={m.value} href={`/admin?month=${m.value}`} className="block">
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

            {/* Management Cards Grid - 2x2 Layout */}
            <div className="admin-management-grid">
                {/* Invoice Management */}
                <Link href="/admin/invoices">
                    <div className="admin-management-card">
                        <div className="admin-management-icon">
                            <FileText />
                        </div>
                        <span className="admin-management-title">請求書管理</span>
                    </div>
                </Link>

                {/* Usage Logs Management */}
                <Link href="/admin/usage-logs">
                    <div className="admin-management-card">
                        <div className="admin-management-icon">
                            <DollarSign />
                        </div>
                        <span className="admin-management-title">利用料金管理</span>
                    </div>
                </Link>

                {/* Reagent Management */}
                <Link href="/admin/reagents">
                    <div className="admin-management-card">
                        <div className="admin-management-icon">
                            <FlaskConical />
                        </div>
                        <span className="admin-management-title">サービス管理</span>
                    </div>
                </Link>

                {/* Equipment Management */}
                <Link href="/admin/equipment">
                    <div className="admin-management-card">
                        <div className="admin-management-icon">
                            <Wrench />
                        </div>
                        <span className="admin-management-title">機器管理</span>
                    </div>
                </Link>

                {/* User Management - Full Width */}
                <Link href="/admin/users">
                    <div className="admin-management-card">
                        <div className="admin-management-icon">
                            <Users />
                        </div>
                        <span className="admin-management-title">利用者管理</span>
                    </div>
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <AdminNotificationsCard />

                <Card className="h-full">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-blue-700" />
                            予約状況
                        </CardTitle>
                        <Link href="/reservations?view=calendar">
                            <Button type="button" variant="outline" size="sm">予約カレンダーを開く</Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {dashboardReservations.length === 0 ? (
                            <p className="text-sm text-slate-500">本日から7日間の予約はありません。</p>
                        ) : (
                            <div className="space-y-3">
                                {dashboardReservations.map((reservation) => (
                                    <div key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                                            <span className="font-medium text-slate-800">{formatTokyoDate(reservation.startTime)}</span>
                                            <span className="text-slate-600">
                                                {formatTokyoTime(reservation.startTime)} - {formatTokyoTime(reservation.endTime)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {reservation.equipment.name} / {reservation.user.name}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Billing Summary */}
            <Card style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '1rem auto 0 auto' }}>
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


            {/* Usage Logs Table */}
            <Card style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '1rem auto 0 auto' }}>
                <CardHeader>
                    <CardTitle>有料サービスログ</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[440px] overflow-y-auto rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky top-0 z-10 bg-white">日時</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white">利用者</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white">試薬名</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white">数量</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white text-right">金額</TableHead>
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
                    </div>
                </CardContent>
            </Card>

            {/* Reservations Table */}
            <Card style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '1rem auto 0 auto' }}>
                <CardHeader>
                    <CardTitle>予約履歴</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[440px] overflow-y-auto rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky top-0 z-10 bg-white">日付</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white">利用者</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white">機器名</TableHead>
                                    <TableHead className="sticky top-0 z-10 bg-white">時間</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reservations.map((res, index) => (
                                    <TableRow key={res.id} style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                        <TableCell>{formatTokyoDate(res.startTime)}</TableCell>
                                        <TableCell>{res.user.name}</TableCell>
                                        <TableCell>{res.equipment.name}</TableCell>
                                        <TableCell>
                                            {formatTokyoTime(res.startTime)} - {formatTokyoTime(res.endTime)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
