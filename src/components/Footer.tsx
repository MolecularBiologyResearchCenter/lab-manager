'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FlaskConical, Home, UserRound } from 'lucide-react'

const navigation = [
    { href: '/', label: 'ホーム', icon: Home },
    { href: '/reservations', label: '予約', icon: CalendarDays },
    { href: '/reagents', label: 'サービス', icon: FlaskConical },
    { href: '/mypage', label: 'マイページ', icon: UserRound },
]

export default function Footer() {
    const pathname = usePathname()
    const isAuthPage = ['/login', '/register', '/forgot-password'].includes(pathname)

    if (isAuthPage) return null

    return (
        <>
            <footer className="hidden border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500 md:block print:hidden">
                北里大学 医学部 分子生物実験センター
            </footer>
            <nav
                className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur md:hidden print:hidden"
                aria-label="モバイルナビゲーション"
            >
                {navigation.map(({ href, label, icon: Icon }) => {
                    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors ${active ? 'text-blue-700' : 'text-slate-500 hover:text-blue-700'}`}
                        >
                            <Icon className="h-5 w-5" />
                            {label}
                        </Link>
                    )
                })}
            </nav>
        </>
    )
}
