import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import InvoiceManager from './InvoiceManager'

export default async function AdminInvoicesPage() {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR')) {
        redirect('/')
    }

    // Get all invoices
    const invoices = await prisma.invoice.findMany({
        include: {
            user: true,
        },
        orderBy: [
            { fiscalYear: 'desc' },
            { quarter: 'desc' },
            { user: { name: 'asc' } },
        ],
    })

    return <InvoiceManager invoices={invoices} />
}
