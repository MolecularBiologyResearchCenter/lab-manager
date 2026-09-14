'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit'

export async function updateUsageLog(
    id: string,
    quantity: number,
    totalCost: number
) {
    const currentUser = await requireAdmin()
    const log = await prisma.usageLog.update({
        where: { id },
        data: {
            quantity,
            totalCost,
        },
    })
    await recordAuditLog({ actor: currentUser, action: 'USAGE_LOG_UPDATE', targetType: 'UsageLog', targetId: id, summary: '利用料金ログを更新しました。', metadata: { quantity: log.quantity, totalCost: log.totalCost } })

    revalidatePath('/admin/usage-logs')
    revalidatePath('/admin')
    revalidatePath('/')
    redirect('/admin/usage-logs')
}

export async function deleteUsageLog(id: string) {
    const currentUser = await requireAdmin()
    const log = await prisma.usageLog.delete({
        where: { id },
    })
    await recordAuditLog({ actor: currentUser, action: 'USAGE_LOG_DELETE', targetType: 'UsageLog', targetId: id, summary: '利用料金ログを削除しました。', metadata: { quantity: log.quantity, totalCost: log.totalCost } })

    revalidatePath('/admin/usage-logs')
    revalidatePath('/admin')
    revalidatePath('/')
    redirect('/admin/usage-logs')
}
