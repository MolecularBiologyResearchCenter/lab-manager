import { getAuthenticatedUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ReagentsAdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getAuthenticatedUser()
    if (!user) redirect('/login')
    if (user.role !== 'ADMIN') redirect('/')
    return children
}
