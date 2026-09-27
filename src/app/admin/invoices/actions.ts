'use server'

import { prisma } from '@/lib/prisma'
import { generateInvoiceForUser, getCurrentQuarter, getQuarterDates, getTokyoDateParts } from '@/lib/invoice'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit'

export async function generateInvoicesForQuarter(year: number, quarter: number, _formData?: FormData): Promise<void> {
    void _formData
    const currentUser = await requireUser()
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'CENTER_DIRECTOR') {
        throw new Error('請求書を発行する権限がありません。')
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || ![1, 2, 3].includes(quarter)) {
        throw new Error('請求期間が正しくありません。')
    }
    // Get all users
    const users = await prisma.user.findMany({
        where: {
            role: 'USER', // Only generate for regular users
        },
        select: { id: true, name: true },
    })

    const { start, end } = getQuarterDates(year, quarter)

    const results = []

    for (const user of users) {
        try {
            // Check if user has any usage logs in this period
            const usageLogs = await prisma.usageLog.findMany({
                where: {
                    userId: user.id,
                    date: {
                        gte: start,
                        lt: end,
                    },
                },
            })

            if (usageLogs.length > 0) {
                // Check if invoice already exists
                const existingInvoice = await prisma.invoice.findFirst({
                    where: {
                        userId: user.id,
                        fiscalYear: year,
                        quarter,
                    },
                })

                if (!existingInvoice) {
                    const invoiceId = await generateInvoiceForUser(user.id, year, quarter)
                    await recordAuditLog({ actor: currentUser, action: 'INVOICE_CREATE', targetType: 'Invoice', targetId: invoiceId, targetLabel: user.name, summary: '請求書を生成しました。', metadata: { year, quarter, userId: user.id } })
                    results.push({
                        userId: user.id,
                        userName: user.name,
                        status: 'success',
                        invoiceId,
                    })
                } else {
                    results.push({
                        userId: user.id,
                        userName: user.name,
                        status: 'skipped',
                        message: '既に請求書が存在します',
                    })
                }
            }
        } catch (error) {
            results.push({
                userId: user.id,
                userName: user.name,
                status: 'error',
                message: error instanceof Error ? error.message : '不明なエラー',
            })
        }
    }

    revalidatePath('/admin/invoices')
    revalidatePath('/invoices')

}

export async function generateCurrentQuarterInvoices() {
    const now = new Date()
    const quarter = getCurrentQuarter(now)
    const year = getTokyoDateParts(now).year

    await generateInvoicesForQuarter(year, quarter)
}
