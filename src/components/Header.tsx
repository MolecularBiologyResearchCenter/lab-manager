import Link from 'next/link'
import { getCurrentUser, logout } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { LogOut, Home, Calendar, FlaskConical, Settings, FileText } from 'lucide-react'

export default async function Header() {
    const user = await getCurrentUser()

    if (!user) return null

    return (
        <header className="header-gradient shadow-md sticky top-0 z-50">
            <div className="content-wrapper">
                <div className="flex items-center justify-between h-16">
                    {/* Logo and Title */}
                    <div className="flex items-center space-x-4 flex-shrink-0 min-w-fit">
                        <Link href="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
                            <div className="flex items-center justify-center flex-shrink-0" style={{ width: '66px', height: '66px' }}>
                                <img
                                    src="/images/kitasato-logo.png"
                                    alt="Kitasato University Logo"
                                    className="w-full h-full rounded-full"
                                />
                            </div>
                            <div className="flex-shrink-0 min-w-fit">
                                <div className="leading-tight whitespace-nowrap" style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-noto-sans-jp), sans-serif', color: 'white' }}>北里大学 医学部</div>
                                <div className="whitespace-nowrap" style={{ fontSize: '1.125rem', fontWeight: 500, fontFamily: 'var(--font-noto-sans-jp), sans-serif', color: 'white', opacity: 0.9 }}>分子生物実験センター</div>
                            </div>
                        </Link>
                    </div>

                    {/* User Info and Logout */}
                    <div className="flex items-center print:hidden">
                        <div className="text-white text-sm" style={{ marginRight: '3rem' }}>
                            <div className="font-medium text-white" style={{ color: 'white' }}>{user.name}さん</div>
                            <div className="text-xs opacity-75 text-white" style={{ color: 'white' }}>{user.department}</div>
                        </div>
                        <form action={logout}>
                            <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
                                <LogOut className="h-4 w-4 mr-2" />
                                ログアウト
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </header>
    )
}
