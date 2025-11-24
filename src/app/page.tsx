'use client'

import { getDashboardData, getCurrentUser } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Home, Calendar, FlaskConical, FileText, Settings, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function HomePage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [totalCost, setTotalCost] = useState(0)
    const [todayReservations, setTodayReservations] = useState<any[]>([])
    const [futureReservations, setFutureReservations] = useState<any[]>([])
    const [showFutureReservations, setShowFutureReservations] = useState(false)
    const [showDetails, setShowDetails] = useState(false)
    const [usageLogs, setUsageLogs] = useState<any[]>([])

    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadData() {
            try {
                const currentUser = await getCurrentUser()
                if (!currentUser) {
                    router.push('/login')
                    return
                }
                setUser(currentUser)

                const { totalCost: fetchedTotalCost, upcomingReservations, usageLogs: fetchedUsageLogs } = await getDashboardData()
                setTotalCost(fetchedTotalCost)

                // Get user's upcoming reservations (all of them)
                const userReservations = upcomingReservations.filter((r: any) => r.userId === currentUser.id)

                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)

                const todayRes = []
                const futureRes = []

                for (const res of userReservations) {
                    const startDate = new Date(res.startTime)
                    if (startDate >= today && startDate < tomorrow) {
                        todayRes.push(res)
                    } else if (startDate >= tomorrow) {
                        futureRes.push(res)
                    }
                }

                setTodayReservations(todayRes)
                setFutureReservations(futureRes)

                setUsageLogs(fetchedUsageLogs.filter((log: any) => log.userId === currentUser.id))
            } catch (err) {
                console.error('Failed to load dashboard data:', err)
                setError((err as Error).message)
            }
        }
        loadData()
    }, [])

    if (error) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
                <p className="text-gray-700">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    再読み込み
                </button>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="py-8">
            <div style={{ maxWidth: '576px', margin: '0 auto', padding: '0 1rem' }}>
                {/* Billing Summary */}
                <Card className="mb-6 border-2 border-gray-800" style={{ backgroundColor: 'white' }}>
                    <CardContent className="p-6 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">今期の利用料金</h2>
                        <div
                            className="text-4xl font-bold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {totalCost.toLocaleString()}円
                            {showDetails ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
                        </div>
                        {showDetails && (
                            <div className="mt-4 text-left text-sm border-t pt-4">
                                {usageLogs.length === 0 ? (
                                    <p className="text-gray-600 text-center">利用履歴はありません</p>
                                ) : (
                                    <>
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 text-left">日付</th>
                                                    <th className="p-2 text-left">利用項目</th>
                                                    <th className="p-2 text-right">単価</th>
                                                    <th className="p-2 text-right">個数</th>
                                                    <th className="p-2 text-right">合計</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usageLogs.map((log: any, index: number) => (
                                                    <tr key={log.id} className="border-b" style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                                        <td className="p-2">
                                                            {new Date(log.date).toLocaleDateString('ja-JP', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                            })}
                                                        </td>
                                                        <td className="p-2">{log.reagent.name}</td>
                                                        <td className="p-2 text-right">¥{log.reagent.unitPrice.toLocaleString()}</td>
                                                        <td className="p-2 text-right">{log.quantity}</td>
                                                        <td className="p-2 text-right">¥{log.totalCost.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-bold">
                                                <tr>
                                                    <td colSpan={4} className="p-2 text-right">利用料合計</td>
                                                    <td className="p-2 text-right">¥{totalCost.toLocaleString()}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Reservations Summary */}
                <Card className="mb-6 border-2 border-gray-800" style={{ backgroundColor: 'white' }}>
                    <CardContent className="p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">今日の予約</h2>
                        {todayReservations.length === 0 ? (
                            <p className="text-gray-600 text-center py-2">本日の予約はありません</p>
                        ) : (
                            <div className="space-y-0">
                                {todayReservations.map((reservation, index: number) => (
                                    <div key={reservation.id} className="flex justify-between text-sm py-2 px-3" style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                        <span>
                                            {new Date(reservation.startTime).toLocaleDateString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                            })}
                                        </span>
                                        <span>{reservation.equipment.name}</span>
                                        <span>
                                            {new Date(reservation.startTime).toLocaleTimeString('ja-JP', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                            -
                                            {new Date(reservation.endTime).toLocaleTimeString('ja-JP', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Future Reservations Collapsible */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <div
                                className="flex items-center justify-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => setShowFutureReservations(!showFutureReservations)}
                            >
                                <h3 className="text-lg font-bold text-gray-700">明日以降の予約</h3>
                                {showFutureReservations ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>

                            {showFutureReservations && (
                                <div className="mt-4">
                                    {futureReservations.length === 0 ? (
                                        <p className="text-gray-600 text-center py-2">明日以降の予約はありません</p>
                                    ) : (
                                        <div className="space-y-0">
                                            {futureReservations.map((reservation, index: number) => (
                                                <div key={reservation.id} className="flex justify-between text-sm py-2 px-3" style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                                    <span>
                                                        {new Date(reservation.startTime).toLocaleDateString('ja-JP', {
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                        })}
                                                    </span>
                                                    <span>{reservation.equipment.name}</span>
                                                    <span>
                                                        {new Date(reservation.startTime).toLocaleTimeString('ja-JP', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                        -
                                                        {new Date(reservation.endTime).toLocaleTimeString('ja-JP', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Navigation Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Home Button */}
                    <a href="https://www.med.kitasato-u.ac.jp/lab/dnalab/home/" target="_blank" rel="noopener noreferrer">
                        <div className="aspect-square border-4 border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: 'hsl(var(--pastel-blue))' }}>
                            <Home className="h-12 w-12 mb-2 text-gray-700" />
                            <span className="text-xl font-bold text-gray-800">センターHP</span>
                        </div>
                    </a>

                    {/* Equipment Reservation Button */}
                    <Link href="/reservations">
                        <div className="aspect-square border-4 border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: 'hsl(var(--pastel-peach))' }}>
                            <Calendar className="h-12 w-12 mb-2 text-gray-700" />
                            <span className="text-xl font-bold text-gray-800">機器予約</span>
                        </div>
                    </Link>

                    {/* Paid Service Button */}
                    <Link href="/reagents">
                        <div className="aspect-square border-4 border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: 'hsl(var(--pastel-pink))' }}>
                            <FlaskConical className="h-12 w-12 mb-2 text-gray-700" />
                            <span className="text-xl font-bold text-gray-800">有料</span>
                            <span className="text-xl font-bold text-gray-800">サービス</span>
                        </div>
                    </Link>

                    {/* Invoice Button */}
                    <Link href="/invoices">
                        <div className="aspect-square border-4 border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: 'hsl(var(--pastel-green))' }}>
                            <FileText className="h-12 w-12 mb-2 text-gray-700" />
                            <span className="text-xl font-bold text-gray-800">請求書</span>
                        </div>
                    </Link>

                    {/* Admin Button (only for admins) */}
                    {user.role === 'ADMIN' && (
                        <Link href="/admin">
                            <div className="aspect-square border-4 border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: 'hsl(var(--pastel-yellow))' }}>
                                <Settings className="h-12 w-12 mb-2 text-gray-700" />
                                <span className="text-xl font-bold text-gray-800">管理画面</span>
                            </div>
                        </Link>
                    )}

                    {/* Empty slot for non-admins */}
                    {user.role !== 'ADMIN' && (
                        <div className="aspect-square border-4 border-gray-600"
                            style={{ backgroundColor: 'hsl(var(--pastel-gray))' }}>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
