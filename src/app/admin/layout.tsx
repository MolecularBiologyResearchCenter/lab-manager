import AdminNav from '@/components/AdminNav'
import { getAuthenticatedUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getAuthenticatedUser()
    if (!user) redirect('/login')
    if (user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR') redirect('/')

    return (
        <div className="admin-area">
            <AdminNav role={user.role} />
            {children}
        </div>
    )
}
