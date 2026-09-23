'use client'

import Link from 'next/link'
import { CalendarDays, FileText, FlaskConical, Home } from 'lucide-react'
import { useUserLanguage } from '@/components/UserLanguageProvider'

const navigation = [
    { href: '/', key: 'home' as const, icon: Home },
    { href: '/reservations', key: 'equipmentReservation' as const, icon: CalendarDays },
    { href: '/reagents', key: 'paidServices' as const, icon: FlaskConical },
    { href: '/invoices', key: 'invoices' as const, icon: FileText },
]

export default function UserNavigation() {
    const { t } = useUserLanguage()

    return (
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('home')}>
            {navigation.map(({ href, key, icon: Icon }) => (
                <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-50 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <Icon className="h-4 w-4" />
                    {t(key)}
                </Link>
            ))}
        </nav>
    )
}
