'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    FileText,
    FlaskConical,
    Gauge,
    DollarSign,
    Users,
    Wrench,
} from 'lucide-react'

const adminNavigation = [
    { href: '/admin', label: '概要', icon: Gauge },
    { href: '/admin/invoices', label: '請求書', icon: FileText },
    { href: '/admin/usage-logs', label: '利用料金', icon: DollarSign },
    { href: '/admin/reagents', label: '有料サービス', icon: FlaskConical },
    { href: '/admin/equipment', label: '機器', icon: Wrench },
    { href: '/admin/users', label: '利用者', icon: Users },
]

export default function AdminNav({ role }: { role: string }) {
    const pathname = usePathname()
    const navigation = role === 'CENTER_DIRECTOR'
        ? adminNavigation.filter(item => item.href === '/admin/invoices')
        : adminNavigation

    return (
        <div className="admin-nav-shell print:hidden">
            <div className="content-wrapper">
                <div className="admin-nav-row">
                    <span className="admin-nav-label">{role === 'CENTER_DIRECTOR' ? 'センター長' : '管理者'}</span>
                    <nav className="admin-nav-links" aria-label="管理者メニュー">
                        {navigation.map(({ href, label, icon: Icon }) => {
                            const isActive = href === '/admin'
                                ? pathname === href
                                : pathname.startsWith(href)

                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`admin-nav-link ${isActive ? 'admin-nav-link-active' : ''}`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>
        </div>
    )
}
