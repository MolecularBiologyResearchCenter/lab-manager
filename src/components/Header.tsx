import Link from 'next/link'
import { getCurrentUser, logout } from '@/app/actions'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import UserNavigation from '@/components/UserNavigation'
import UserLanguageText from '@/components/UserLanguageText'
import {
    CalendarDays,
    CircleUserRound,
    ClipboardList,
    DollarSign,
    FileText,
    FlaskConical,
    Gauge,
    LogOut,
    Users,
    Wrench,
} from 'lucide-react'

const adminNavigation = [
    { href: '/admin', label: '概要', icon: Gauge },
    { href: '/reservations?view=calendar', label: 'カレンダー', icon: CalendarDays },
    { href: '/admin/invoices', label: '請求書', icon: FileText },
    { href: '/admin/usage-logs', label: '利用料金', icon: DollarSign },
    { href: '/admin/reagents', label: 'サービス', icon: FlaskConical },
    { href: '/admin/equipment', label: '機器', icon: Wrench },
    { href: '/admin/users', label: '利用者', icon: Users },
    { href: '/admin/audit-logs', label: '監査ログ', icon: ClipboardList },
]

export default async function Header() {
    const user = await getCurrentUser()
    if (!user) return null

    return (
        <header className={`sticky top-0 z-50 border-b border-blue-800/20 bg-blue-700 text-white shadow-sm print:hidden ${user.role === 'ADMIN' ? 'admin-header' : 'user-header'}`}>
            <div className="content-wrapper">
                <div className="flex min-h-16 items-center justify-between gap-4 py-2">
                    <Link href="/" className="flex flex-shrink-0 items-center gap-3 transition-opacity hover:opacity-90">
                        <img
                            src="/images/kitasato-logo.png"
                            alt="北里大学"
                            className="h-10 w-10 flex-shrink-0 object-contain md:h-11 md:w-11"
                        />
                        <div className="min-w-0 leading-tight">
                            <div className="whitespace-nowrap text-sm font-medium md:text-base">分子生物実験センター</div>
                            <div className="mt-0.5 text-[10px] tracking-[0.18em] text-blue-100">LAB MANAGER</div>
                        </div>
                    </Link>

                    {user.role === 'ADMIN' ? (
                        <nav className="admin-header-nav" aria-label="管理者メニュー">
                            {adminNavigation.map(({ href, label, icon: Icon }) => (
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
                    ) : <div className="flex-1" />}

                    <div className="flex flex-shrink-0 items-center gap-1 md:gap-3">
                        {user.role === 'USER' && <LanguageSwitcher />}
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
                                <span className="hidden md:inline">{user.role === 'USER' ? <UserLanguageText k="logout" /> : 'ログアウト'}</span>
                            </Button>
                        </form>
                    </div>
                </div>
                {user.role === 'USER' && (
                    <div className="border-t border-white/15">
                        <UserNavigation />
                    </div>
                )}
            </div>
        </header>
    )
}
