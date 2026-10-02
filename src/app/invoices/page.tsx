import { getCurrentUser } from '../actions'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import UserInvoicesView from '@/components/UserInvoicesView'
import { performanceTrace } from '@/lib/performance'

export default async function InvoicesPage() {
    const trace = performanceTrace('page.invoices')
    const user = await trace.measure('auth', getCurrentUser)
    if (!user) redirect('/login')

    const invoices = await trace.measure('prismaQuery', () => prisma.invoice.findMany({
        where: { userId: user.id },
        select: {
            id: true,
            fiscalYear: true,
            quarter: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            sealedAt: true,
            sealedBy: true,
        },
        orderBy: [{ fiscalYear: 'desc' }, { quarter: 'desc' }],
    }))
    trace.finish()

    return <UserInvoicesView invoices={invoices} />
}
