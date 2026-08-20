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
import { FileText, DollarSign, FlaskConical, Wrench, Users } from 'lucide-react'

export default async function AdminPage(props: { searchParams: Promise<{ month?: string; year?: string }> }) {
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
            <div className="flex justify-center items-center">
                <h1 className="text-4xl font-bold">管理者ダッシュボード</h1>
            </div>

            <div className="space-y-4">
                {/* Year Selector */}
                <div className="flex items-center justify-center gap-2">
                    <AdminYearSelect currentYear={currentYear} />
                </div>

                {/* Month Selector */}
                <div className="flex flex-wrap justify-center gap-2">
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

            {/* Management Cards Grid - 2x2 Layout */}
            <div className="grid grid-cols-2 auto-rows-fr" style={{ gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>
                {/* Invoice Management */}
                <Link href="/admin/invoices" className="h-full block" style={{ textDecoration: 'none' }}>
                    <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                        style={{
                            backgroundColor: 'white',
                            border: '3px solid #3b82f6',
                            borderRadius: '24px',
                            minHeight: '140px'
                        }}>
                        <div className="bg-blue-100 p-4 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                            <FileText style={{ color: '#1e40af', width: '60px', height: '60px' }} />
                        </div>
                        <span className="text-lg font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700 }}>請求書管理</span>
                    </div>
                </Link>

                {/* Usage Logs Management */}
                <Link href="/admin/usage-logs" className="h-full block" style={{ textDecoration: 'none' }}>
                    <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                        style={{
                            backgroundColor: 'white',
                            border: '3px solid #3b82f6',
                            borderRadius: '24px',
                            minHeight: '140px'
                        }}>
                        <div className="bg-blue-100 p-4 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                            <DollarSign style={{ color: '#1e40af', width: '60px', height: '60px' }} />
                        </div>
                        <span className="text-lg font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700 }}>利用料金管理</span>
                    </div>
                </Link>

                {/* Reagent Management */}
                <Link href="/admin/reagents" className="h-full block" style={{ textDecoration: 'none' }}>
                    <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                        style={{
                            backgroundColor: 'white',
                            border: '3px solid #3b82f6',
                            borderRadius: '24px',
                            minHeight: '140px'
                        }}>
                        <div className="bg-blue-100 p-4 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                            <FlaskConical style={{ color: '#1e40af', width: '60px', height: '60px' }} />
                        </div>
                        <span className="text-lg font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700 }}>有料サービス管理</span>
                    </div>
                </Link>

                {/* Equipment Management */}
                <Link href="/admin/equipment" className="h-full block" style={{ textDecoration: 'none' }}>
                    <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                        style={{
                            backgroundColor: 'white',
                            border: '3px solid #3b82f6',
                            borderRadius: '24px',
                            minHeight: '140px'
                        }}>
                        <div className="bg-blue-100 p-4 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                            <Wrench style={{ color: '#1e40af', width: '60px', height: '60px' }} />
                        </div>
                        <span className="text-lg font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700 }}>機器管理</span>
                    </div>
                </Link>

                {/* User Management - Full Width */}
                <Link href="/admin/users" className="col-span-2 h-full block" style={{ textDecoration: 'none' }}>
                    <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-4"
                        style={{
                            backgroundColor: 'white',
                            border: '3px solid #3b82f6',
                            borderRadius: '24px',
                            minHeight: '140px'
                        }}>
                        <div className="bg-blue-100 p-4 rounded-lg" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                            <Users style={{ color: '#1e40af', width: '60px', height: '60px' }} />
                        </div>
                        <span className="text-lg font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700 }}>利用者管理</span>
                    </div>
                </Link>
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

            {/* Reservations Table */}
            <Card style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '1rem auto 0 auto' }}>
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
