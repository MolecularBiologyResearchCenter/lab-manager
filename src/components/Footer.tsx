'use client';
import { Home, User } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer
            style={{
                background: 'linear-gradient(to right, rgb(96 165 250), rgb(29 78 216))',
                height: '4.5rem', // Increased height slightly for labels
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTop: '1px solid #d1d5db',
                marginTop: '2rem',
            }}
        >
            <div className="flex items-center footer-gap">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .footer-gap { gap: 3rem; }
                    @media (min-width: 768px) { .footer-gap { gap: 8rem; } }
                `}} />
                <Link href="/" className="flex flex-col items-center group no-underline">
                    <Home className="h-6 w-6 group-hover:opacity-80 transition-opacity" color="white" style={{ color: 'white' }} />
                    <span className="text-[10px] mt-1 font-medium text-white" style={{ color: 'white' }}>ホーム</span>
                </Link>
                <Link href="/mypage" className="flex flex-col items-center group no-underline">
                    <User className="h-6 w-6 group-hover:opacity-80 transition-opacity" color="white" style={{ color: 'white' }} />
                    <span className="text-[10px] mt-1 font-medium text-white" style={{ color: 'white' }}>マイページ</span>
                </Link>
            </div>
        </footer>
    );
}
