import Link from 'next/link'
import { getCurrentUser, logout } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { CalendarDays, CircleUserRound, FileText, FlaskConical, Home, LogOut } from 'lucide-react'

const navigation = [
    { href: '/', label: 'ホーム', icon: Home },
    { href: '/reservations', label: '機器予約', icon: CalendarDays },
    { href: '/reagents', label: '有料サービス', icon: FlaskConical },
    { href: '/invoices', label: '請求書', icon: FileText },
]

export default async function Header() {
    const user = await getCurrentUser()
    if (!user) return null

    return (
        <header className="sticky top-0 z-50 border-b border-blue-800/20 bg-blue-700 text-white shadow-sm print:hidden">
            <div className="content-wrapper">
                <div className="flex min-h-16 items-center justify-between gap-4 py-2">
                    <Link href="/" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
                        <img
                            src="/images/kitasato-logo.png"
                            alt="北里大学"
                            className="h-10 w-10 flex-shrink-0 object-contain md:h-11 md:w-11"
                        />
                        <div className="min-w-0 leading-tight">
                            <div className="truncate text-sm font-medium md:text-base">分子生物実験センター</div>
                            <div className="mt-0.5 text-[10px] tracking-[0.18em] text-blue-100">LAB MANAGER</div>
                        </div>
                    </Link>

                    <nav className="hidden items-center gap-1 lg:flex" aria-label="メインナビゲーション">
                        {navigation.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-50 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex flex-shrink-0 items-center gap-1 md:gap-3">
                        <Link
                            href="/mypage"
                            className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-white transition-colors hover:bg-white/10 md:px-3"
                        >
                            <CircleUserRound className="h-5 w-5" />
                            <span className="hidden md:inline">{user.name}さん</span>
                        </Link>
                        <form action={logout}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-10 text-white hover:bg-white/10 hover:text-white"
                                aria-label="ログアウト"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden md:inline">ログアウト</span>
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </header>
    )
}
