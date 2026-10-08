'use server'

import { prisma } from '@/lib/prisma'
import { generateInvoiceForUser, getAnnualRegistrationFee, getCurrentQuarter, getQuarterDates, getTokyoDateParts } from '@/lib/invoice'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { recordAuditLog, runAuditedOperation } from '@/lib/audit'
import { claimIdempotencyKey, completeIdempotencyKey, releaseIdempotencyKey } from '@/lib/idempotency'
import { performanceTrace } from '@/lib/performance'

export async function generateInvoicesForQuarter(year: number, quarter: number, _formData?: FormData): Promise<void> {
    return runAuditedOperation('INVOICE_CREATE', 'Invoice', null, async () => {
    const trace = performanceTrace('invoice.generate')
    const currentUser = await requireUser()
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'CENTER_DIRECTOR') {
        throw new Error('請求書を発行する権限がありません。')
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || ![1, 2, 3].includes(quarter)) {
        throw new Error('請求期間が正しくありません。')
    }
    const idempotencyKey = _formData?.get('idempotencyKey')?.toString()
    const claim = await claimIdempotencyKey(currentUser.id, 'invoice.generate', idempotencyKey)
    if (claim.state === 'duplicate') return

    try {
    const { start, end } = getQuarterDates(year, quarter)
    const [users, usageByUser, existingInvoices] = await Promise.all([
        prisma.user.findMany({
        where: {
            role: 'USER', // Only generate for regular users
            enrollmentStatus: 'ACTIVE',
        },
        select: { id: true, name: true, affiliationType: true, createdAt: true },
        }),
        prisma.usageLog.groupBy({
            by: ['userId'],
            where: { date: { gte: start, lt: end } },
            _count: { _all: true },
        }),
        prisma.invoice.findMany({
            where: { fiscalYear: year, quarter },
            select: { userId: true },
        }),
    ])
    const usageUserIds = new Set(usageByUser.filter((usage) => usage._count._all > 0).map((usage) => usage.userId))
    const invoiceUserIds = new Set(existingInvoices.map((invoice) => invoice.userId))
    const pendingUsers = users.filter((user) => (usageUserIds.has(user.id) || getAnnualRegistrationFee(user.affiliationType, user.createdAt, year, quarter) > 0) && !invoiceUserIds.has(user.id))
    await Promise.all(pendingUsers.map(async (user) => {
        const invoiceId = await generateInvoiceForUser(user.id, year, quarter)
        await recordAuditLog({ actor: currentUser, action: 'INVOICE_CREATE', targetType: 'Invoice', targetId: invoiceId, summary: '請求書を生成しました。', metadata: { year, quarter, userId: user.id, affiliationType: user.affiliationType, annualRegistrationFee: getAnnualRegistrationFee(user.affiliationType, user.createdAt, year, quarter) } })
    }))

    revalidatePath('/admin/invoices')
    revalidatePath('/invoices')
    await completeIdempotencyKey(currentUser.id, 'invoice.generate', idempotencyKey!, { success: true, generatedCount: pendingUsers.length })
    trace.finish('success', { generatedCount: pendingUsers.length })
    } catch (error) {
        await releaseIdempotencyKey(currentUser.id, 'invoice.generate', idempotencyKey)
        trace.finish('failure')
        throw error
    }

    })
}

export async function generateCurrentQuarterInvoices() {
    const now = new Date()
    const quarter = getCurrentQuarter(now)
    const year = getTokyoDateParts(now).year

    await generateInvoicesForQuarter(year, quarter)
}
