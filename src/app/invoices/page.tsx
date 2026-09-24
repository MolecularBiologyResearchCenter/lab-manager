import { getCurrentUser } from '../actions'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import UserInvoicesView from '@/components/UserInvoicesView'

export default async function InvoicesPage() {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const invoices = await prisma.invoice.findMany({
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
    })

    return <UserInvoicesView invoices={invoices} />
}
