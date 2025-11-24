import { prisma } from '@/lib/prisma'

/**
 * Get the current quarter (1, 2, or 3) based on the month
 */
export function getCurrentQuarter(date: Date): number {
    const month = date.getMonth()
    if (month >= 0 && month <= 3) return 1
    if (month >= 4 && month <= 7) return 2
    return 3
}

/**
 * Get the start and end dates for a given quarter
 */
export function getQuarterDates(year: number, quarter: number): { start: Date; end: Date } {
    let startMonth: number
    let endMonth: number

    switch (quarter) {
        case 1:
            startMonth = 0 // January
            endMonth = 3 // April
            break
        case 2:
            startMonth = 4 // May
            endMonth = 7 // August
            break
        case 3:
            startMonth = 8 // September
            endMonth = 11 // December
            break
        default:
            throw new Error('Invalid quarter')
    }

    const start = new Date(year, startMonth, 1)
    const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999)

    return { start, end }
}

/**
 * Generate a unique invoice number
 * Format: INV-YYYY-QX-NNNN (e.g., INV-2025-Q1-0001)
 */
export async function generateInvoiceNumber(year: number, quarter: number): Promise<string> {
    const prefix = `INV-${year}-Q${quarter}-`

    // Find the latest invoice for this quarter
    const latestInvoice = await prisma.invoice.findFirst({
        where: {
            fiscalYear: year,
            quarter: quarter,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    let sequenceNumber = 1
    if (latestInvoice) {
        // Extract sequence number from the last invoice number
        const match = latestInvoice.invoiceNumber.match(/-(\d+)$/)
        if (match) {
            sequenceNumber = parseInt(match[1]) + 1
        }
    }

    return `${prefix}${sequenceNumber.toString().padStart(4, '0')}`
}

/**
 * Generate invoice for a user for a specific quarter
 */
export async function generateInvoiceForUser(
    userId: string,
    year: number,
    quarter: number
): Promise<string> {
    const { start, end } = getQuarterDates(year, quarter)

    // Get all usage logs for this period
    const usageLogs = await prisma.usageLog.findMany({
        where: {
            userId,
            date: {
                gte: start,
                lte: end,
            },
        },
        include: {
            reagent: true,
        },
        orderBy: {
            date: 'asc',
        },
    })

    if (usageLogs.length === 0) {
        throw new Error('この期間の利用履歴がありません')
    }

    // Calculate total amount
    const totalAmount = usageLogs.reduce((sum, log) => sum + log.totalCost, 0)

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(year, quarter)

    // Create invoice
    const invoice = await prisma.invoice.create({
        data: {
            invoiceNumber,
            userId,
            fiscalYear: year,
            quarter,
            startDate: start,
            endDate: end,
            totalAmount,
            status: 'issued',
            items: {
                create: usageLogs.map((log) => ({
                    date: log.date,
                    itemName: log.reagent.name,
                    unitPrice: log.reagent.unitPrice,
                    quantity: log.quantity,
                    amount: log.totalCost,
                    reagentLogId: log.id,
                })),
            },
        },
        include: {
            items: true,
            user: true,
        },
    })

    return invoice.id
}
