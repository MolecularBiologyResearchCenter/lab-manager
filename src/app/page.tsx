'use client'

import { getDashboardData, getCurrentUser } from './actions'
import Link from 'next/link'
import {
    CalendarDays,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ExternalLink,
    FileText,
    FlaskConical,
    Settings,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function HomePage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [totalCost, setTotalCost] = useState(0)
    const [todayReservations, setTodayReservations] = useState<any[]>([])
    const [futureReservations, setFutureReservations] = useState<any[]>([])
    const [showFutureReservations, setShowFutureReservations] = useState(false)
    const [showDetails, setShowDetails] = useState(false)
    const [usageLogs, setUsageLogs] = useState<any[]>([])
    const [periodLabel, setPeriodLabel] = useState('')
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

                const {
                    upcomingReservations,
                    usageLogs: fetchedUsageLogs,
                    fiscalYear,
                    quarterLabel,
                } = await getDashboardData()
                setPeriodLabel(`${fiscalYear}年 ${quarterLabel}`)

                const userUsageLogs = fetchedUsageLogs.filter((log: any) => log.userId === currentUser.id)
                setUsageLogs(userUsageLogs)
                setTotalCost(userUsageLogs.reduce((sum: number, log: any) => sum + log.totalCost, 0))

                const userReservations = upcomingReservations.filter((reservation: any) => reservation.userId === currentUser.id)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)

                setTodayReservations(userReservations.filter((reservation: any) => {
                    const start = new Date(reservation.startTime)
                    return start >= today && start < tomorrow
                }))
                setFutureReservations(userReservations.filter((reservation: any) => new Date(reservation.startTime) >= tomorrow))
            } catch (err) {
                console.error('Failed to load dashboard data:', err)
                setError((err as Error).message)
            }
        }
        loadData()
    }, [router])

    if (error) {
        return (
            <div className="content-wrapper app-page text-center">
                <div className="app-surface mx-auto max-w-lg p-8">
                    <h1 className="text-xl font-bold text-red-600">エラーが発生しました</h1>
                    <p className="mt-2 text-sm text-slate-600">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white">
                        再読み込み
                    </button>
                </div>
            </div>
        )
    }

    if (!user) return null

    const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
    })

    const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
    })

    const menuItems = [
        { href: '/reservations', label: '機器予約', description: '空き状況を確認して予約', icon: CalendarDays },
        { href: '/reagents', label: '有料サービス', description: '利用内容と数量を記録', icon: FlaskConical },
        { href: '/invoices', label: '請求書', description: '請求内容を確認', icon: FileText },
    ]

    return (
        <div className="content-wrapper app-page">
            <div className="mb-6">
                <h1 className="app-page-title">おはようございます、{user.name}さん</h1>
                <p className="app-page-description">今日の予定と利用状況を確認できます</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <section className="app-surface p-5 md:p-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="font-semibold text-slate-800">今日の予約</h2>
                        <Link href="/reservations?view=calendar" className="text-xs font-medium text-blue-700 hover:underline">
                            すべて見る
                        </Link>
                    </div>

                    {todayReservations.length === 0 ? (
                        <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            本日の予約はありません
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {todayReservations.map((reservation) => (
                                <div key={reservation.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-3">
                                    <span className="font-semibold text-blue-700">{formatTime(reservation.startTime)}</span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-800">{reservation.equipment.name}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{formatTime(reservation.startTime)}–{formatTime(reservation.endTime)}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowFutureReservations(!showFutureReservations)}
                            className="flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                            aria-expanded={showFutureReservations}
                        >
                            <span>明日以降の予約</span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                                {futureReservations.length}件
                                {showFutureReservations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                        </button>
                        {showFutureReservations && (
                            <div className="mt-2 divide-y divide-slate-100">
                                {futureReservations.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-slate-500">予約はありません</p>
                                ) : futureReservations.map((reservation) => (
                                    <div key={reservation.id} className="grid grid-cols-[4rem_1fr_auto] gap-3 px-2 py-3 text-sm">
                                        <span className="text-slate-500">{formatDate(reservation.startTime)}</span>
                                        <span className="truncate font-medium text-slate-700">{reservation.equipment.name}</span>
                                        <span className="text-slate-500">{formatTime(reservation.startTime)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="app-surface p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="font-semibold text-slate-800">今期の利用料金</h2>
                            <p className="mt-1 text-xs text-slate-500">{periodLabel}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDetails(!showDetails)}
                            className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            aria-expanded={showDetails}
                        >
                            明細
                            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    </div>
                    <p className="mt-5 text-3xl font-bold tracking-tight text-slate-800 md:text-4xl">{totalCost.toLocaleString()}円</p>

                    {showDetails && (
                        <div className="mt-5 border-t border-slate-100 pt-3">
                            {usageLogs.length === 0 ? (
                                <p className="py-3 text-center text-sm text-slate-500">利用履歴はありません</p>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {usageLogs.map((log: any) => (
                                        <div key={log.id} className="grid grid-cols-[4.5rem_1fr_auto] gap-2 py-2 text-xs">
                                            <span className="text-slate-500">{formatDate(log.date)}</span>
                                            <span className="truncate text-slate-700">{log.reagent.name}</span>
                                            <span className="font-medium text-slate-700">{log.totalCost.toLocaleString()}円</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {menuItems.map(({ href, label, description, icon: Icon }) => (
                    <Link key={href} href={href} className="app-surface group flex min-h-24 items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                            <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-800">{label}</span>
                            <span className="mt-1 block text-xs text-slate-500">{description}</span>
                        </span>
                    </Link>
                ))}
                <a href="https://www.med.kitasato-u.ac.jp/lab/dnalab/home/" target="_blank" rel="noopener noreferrer" className="app-surface group flex min-h-24 items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                        <ExternalLink className="h-5 w-5" />
                    </span>
                    <span>
                        <span className="block text-sm font-semibold text-slate-800">センターHP</span>
                        <span className="mt-1 block text-xs text-slate-500">公式サイトを開く</span>
                    </span>
                </a>
            </div>

            {user.role === 'ADMIN' && (
                <Link href="/admin" className="app-surface mt-3 flex min-h-16 items-center gap-4 p-4 transition hover:shadow-md">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Settings className="h-5 w-5" /></span>
                    <span className="text-sm font-semibold text-slate-800">管理画面</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
                </Link>
            )}
        </div>
    )
}
