import { prisma } from '@/lib/prisma'

export type InvoiceQuarter = 1 | 2 | 3

export function getTokyoDateParts(date: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date)
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    return { year: value('year'), month: value('month'), day: value('day') }
}

/** Billing periods are fixed to Tokyo calendar boundaries. */
export function getCurrentQuarter(date: Date): InvoiceQuarter {
    const month = getTokyoDateParts(date).month
    if (month >= 1 && month <= 4) return 1
    if (month >= 5 && month <= 8) return 2
    return 3
}

/** Return an exclusive end boundary; Date values are UTC instants for JST midnight. */
export function getQuarterDates(year: number, quarter: number): { start: Date; end: Date } {
    const startMonth = quarter === 1 ? 1 : quarter === 2 ? 5 : quarter === 3 ? 9 : null
    if (!startMonth) throw new Error('Invalid quarter')
    const start = new Date(Date.UTC(year, startMonth - 1, 1, -9))
    const end = new Date(Date.UTC(year, startMonth === 9 ? 12 : startMonth + 3, 1, -9))
    return { start, end }
}

export function getPeriodKey(year: number, quarter: number): string {
    if (!Number.isInteger(year) || ![1, 2, 3].includes(quarter)) throw new Error('Invalid invoice period')
    return `${year}-Q${quarter}`
}

export function parsePeriodKey(periodKey: string): { year: number; quarter: InvoiceQuarter } | null {
    const match = /^(\d{4})-Q([123])$/.exec(periodKey)
    if (!match) return null
    return { year: Number(match[1]), quarter: Number(match[2]) as InvoiceQuarter }
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

    const invoiceUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { affiliationType: true, enrollmentStatus: true },
    })
    if (!invoiceUser || invoiceUser.enrollmentStatus !== 'ACTIVE') {
        throw new Error('現在の在籍状態では新規請求書を発行できません')
    }

    // Get all usage logs for this period
    const usageLogs = await prisma.usageLog.findMany({
        where: {
            userId,
            date: {
                gte: start,
                lt: end,
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
            affiliationTypeSnapshot: invoiceUser.affiliationType,
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
            user: { select: { id: true, name: true, department: true, laboratory: true } },
        },
    })

    return invoice.id
}
