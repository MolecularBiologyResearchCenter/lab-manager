'use server'

import { prisma } from '@/lib/prisma'
import { generateInvoiceForUser, getCurrentQuarter, getQuarterDates } from '@/lib/invoice'
import { revalidatePath } from 'next/cache'

export async function generateInvoicesForQuarter(year: number, quarter: number) {
    // Get all users
    const users = await prisma.user.findMany({
        where: {
            role: 'USER', // Only generate for regular users
        },
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
                        lte: end,
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

    return results
}

export async function generateCurrentQuarterInvoices() {
    const now = new Date()
    const quarter = getCurrentQuarter(now)
    const year = now.getFullYear()

    await generateInvoicesForQuarter(year, quarter)
}
