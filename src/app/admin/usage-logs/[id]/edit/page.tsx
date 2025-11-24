import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import UsageLogEditForm from './UsageLogEditForm'

export default async function EditUsageLogPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        redirect('/')
    }

    const { id } = await params

    const log = await prisma.usageLog.findUnique({
        where: { id },
        include: {
            user: true,
            reagent: true,
        },
    })

    if (!log) {
        redirect('/admin/usage-logs')
    }

    return <UsageLogEditForm log={log} />
}
