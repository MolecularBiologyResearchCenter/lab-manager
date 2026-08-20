import Link from 'next/link';
import { getCurrentUser, logout } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default async function Header() {
    const user = await getCurrentUser();
    if (!user) return null;

    return (
        <header className="header-gradient shadow-md sticky top-0 z-50" style={{ background: 'linear-gradient(to right, rgb(96 165 250), rgb(29 78 216))' }}>
            <div className="content-wrapper">
                <div className="flex flex-col md:flex-row items-center justify-between h-auto md:h-20 py-2">
                    {/* Logo and Title */}
                    <Link href="/" className="flex items-center hover:opacity-90 transition-opacity mx-auto md:mx-0">
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: '66px', height: '66px', marginRight: '12px' }}>
                            <img src="/images/kitasato-logo.png" alt="Kitasato University Logo" className="w-full h-full rounded-full" />
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 400,
                            fontFamily: 'var(--font-noto-sans-jp), sans-serif',
                            color: 'white',
                            textAlign: 'center'
                        }}>
                            {/* Responsive Title - Single Structure */}
                            <div className="responsive-header-title">
                                <span className="title-part-1">北里大学 医学部</span>
                                <span className="title-part-2">分子生物実験センター</span>
                            </div>
                        </div>
                    </Link>

                    {/* User Info and Logout */}
                    <div className="flex flex-row items-center print:hidden mt-2 md:mt-0 header-user-gap">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .header-user-gap { gap: 1.5rem; }
                            @media (min-width: 768px) { .header-user-gap { gap: 3rem; } }
                        `}} />
                        <Link href="/mypage" className="text-white text-sm text-left hover:opacity-80 transition-opacity" style={{ color: 'white' }}>
                            <div className="font-medium">{user.name}さん</div>
                        </Link>
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
    );
}
