'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateUsageLog(
    id: string,
    quantity: number,
    totalCost: number
) {
    await prisma.usageLog.update({
        where: { id },
        data: {
            quantity,
            totalCost,
        },
    })

    revalidatePath('/admin/usage-logs')
    revalidatePath('/admin')
    revalidatePath('/')
    redirect('/admin/usage-logs')
}

export async function deleteUsageLog(id: string) {
    await prisma.usageLog.delete({
        where: { id },
    })

    revalidatePath('/admin/usage-logs')
    revalidatePath('/admin')
    revalidatePath('/')
    redirect('/admin/usage-logs')
}
