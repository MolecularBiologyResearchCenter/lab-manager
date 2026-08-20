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
    const [periodLabel, setPeriodLabel] = useState<string>('')

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

                const { totalCost: fetchedTotalCost, upcomingReservations, usageLogs: fetchedUsageLogs, fiscalYear, quarterLabel } = await getDashboardData()
                setPeriodLabel(`(${fiscalYear}年${quarterLabel})`)

                // Filter usage logs for current user and calculate total cost
                const userUsageLogs = fetchedUsageLogs.filter((log: any) => log.userId === currentUser.id)
                const userTotalCost = userUsageLogs.reduce((sum: number, log: any) => sum + log.totalCost, 0)

                setTotalCost(userTotalCost)

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
            <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 1.5rem' }}>
                {/* Billing Summary */}
                <Card className="border-2 border-blue-500 rounded-xl overflow-hidden" style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '2px solid #2563eb', marginTop: '1rem', marginBottom: '1rem' }}>
                    <CardContent className="p-8 text-center">
                        <h2 className="text-3xl font-bold text-gray-800 mb-0 leading-none">今期の利用料金</h2>
                        <p className="text-sm text-gray-500 mb-0 -mt-1 leading-none">{periodLabel}</p>
                        <div
                            className="text-5xl font-bold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors flex items-center justify-center gap-2 -mt-1"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {totalCost.toLocaleString()}円
                            {showDetails ? <ChevronUp className="h-8 w-8" /> : <ChevronDown className="h-8 w-8" />}
                        </div>
                        {showDetails && (
                            <div className="mt-4 border-t pt-4">
                                {usageLogs.length === 0 ? (
                                    <p className="text-gray-600 text-center py-2">利用履歴はありません</p>
                                ) : (
                                    <>
                                        <div className="space-y-0">
                                            {usageLogs.map((log: any, index: number) => (
                                                <div key={log.id} className="flex justify-between text-sm py-2 px-3" style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                                    <span>
                                                        {new Date(log.date).toLocaleDateString('ja-JP', {
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                        })}
                                                    </span>
                                                    <span>{log.reagent.name}</span>
                                                    <span>¥{log.totalCost.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-bold text-sm px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                                            <span>利用料合計</span>
                                            <span>¥{totalCost.toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Reservations Summary */}
                <Card className="border-2 border-blue-500 rounded-xl overflow-hidden" style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '2px solid #2563eb', marginBottom: '1rem' }}>
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">今日の予約</h2>
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
                                <h3 className="text-xl font-bold text-gray-700">明日以降の予約</h3>
                                {showFutureReservations ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
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

                {/* Navigation Grid - 2x2 Layout */}
                <div className="grid grid-cols-2 auto-rows-fr" style={{ gap: '1rem' }}>
                    {/* Home Button */}
                    <a href="https://www.med.kitasato-u.ac.jp/lab/dnalab/home/" target="_blank" rel="noopener noreferrer" className="h-full block" style={{ textDecoration: 'none' }}>
                        <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                            style={{
                                backgroundColor: 'white',
                                border: '3px solid #3b82f6',
                                borderRadius: '24px',
                                minHeight: '120px'
                            }}>
                            <div className="bg-blue-100 p-6 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                                <Home style={{ color: '#1e40af', width: '80px', height: '80px' }} />
                            </div>
                            <span className="text-xl font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>センターHP</span>
                        </div>
                    </a>

                    {/* Equipment Reservation Button */}
                    <Link href="/reservations" className="h-full block" style={{ textDecoration: 'none' }}>
                        <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                            style={{
                                backgroundColor: 'white',
                                border: '3px solid #3b82f6',
                                borderRadius: '24px',
                                minHeight: '120px'
                            }}>
                            <div className="bg-blue-100 p-6 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                                <Calendar style={{ color: '#1e40af', width: '80px', height: '80px' }} />
                            </div>
                            <span className="text-xl font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>機器予約</span>
                        </div>
                    </Link>

                    {/* Paid Service Button */}
                    <Link href="/reagents" className="h-full block" style={{ textDecoration: 'none' }}>
                        <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                            style={{
                                backgroundColor: 'white',
                                border: '3px solid #3b82f6',
                                borderRadius: '24px',
                                minHeight: '120px'
                            }}>
                            <div className="bg-blue-100 p-6 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                                <FlaskConical style={{ color: '#1e40af', width: '80px', height: '80px' }} />
                            </div>
                            <span className="text-xl font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>有料サービス</span>
                        </div>
                    </Link>

                    {/* Invoice Button */}
                    <Link href="/invoices" className="h-full block" style={{ textDecoration: 'none' }}>
                        <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center"
                            style={{
                                backgroundColor: 'white',
                                border: '3px solid #3b82f6',
                                borderRadius: '24px',
                                minHeight: '120px'
                            }}>
                            <div className="bg-blue-100 p-6 rounded-lg mb-3" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                                <FileText style={{ color: '#1e40af', width: '80px', height: '80px' }} />
                            </div>
                            <span className="text-xl font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>請求書</span>
                        </div>
                    </Link>

                    {/* Admin Button (only for admins) */}
                    {user.role === 'ADMIN' && (
                        <Link href="/admin" className="col-span-2 h-full block" style={{ textDecoration: 'none' }}>
                            <div className="h-full rounded-3xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-4"
                                style={{
                                    backgroundColor: 'white',
                                    border: '3px solid #3b82f6',
                                    borderRadius: '24px',
                                    minHeight: '120px'
                                }}>
                                <div className="bg-blue-100 p-6 rounded-lg" style={{ backgroundColor: '#bfdbfe', borderRadius: '12px' }}>
                                    <Settings style={{ color: '#1e40af', width: '80px', height: '80px' }} />
                                </div>
                                <span className="text-xl font-bold text-gray-900 leading-tight" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>管理画面</span>
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
