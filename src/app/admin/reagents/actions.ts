'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit'

export async function getReagents() {
    await requireAdmin()
    try {
        const reagents = await prisma.reagent.findMany({
            orderBy: {
                name: 'asc',
            },
        })
        return { success: true, reagents }
    } catch (error) {
        console.error('Failed to fetch reagents:', error)
        return { success: false, error: 'Failed to fetch reagents' }
    }
}

export async function createReagent(formData: FormData) {
    const currentUser = await requireAdmin()
    try {
        const name = formData.get('name') as string
        const unitPrice = parseFloat(formData.get('unitPrice') as string)

        if (!name || isNaN(unitPrice)) {
            return { success: false, error: 'Invalid input' }
        }

        const reagent = await prisma.reagent.create({
            data: {
                name,
                unitPrice,
            },
        })
        await recordAuditLog({ actor: currentUser, action: 'REAGENT_CREATE', targetType: 'Reagent', targetId: reagent.id, targetLabel: reagent.name, summary: '有料サービスを追加しました。' })

        revalidatePath('/admin/reagents')
        return { success: true }
    } catch (error) {
        console.error('Failed to create reagent:', error)
        return { success: false, error: 'Failed to create reagent' }
    }
}

export async function updateReagent(id: string, formData: FormData) {
    const currentUser = await requireAdmin()
    try {
        const name = formData.get('name') as string
        const unitPrice = parseFloat(formData.get('unitPrice') as string)

        if (!name || isNaN(unitPrice)) {
            return { success: false, error: 'Invalid input' }
        }

        const reagent = await prisma.reagent.update({
            where: { id },
            data: {
                name,
                unitPrice,
            },
        })
        await recordAuditLog({ actor: currentUser, action: 'REAGENT_UPDATE', targetType: 'Reagent', targetId: reagent.id, targetLabel: reagent.name, summary: '有料サービスを更新しました。' })

        revalidatePath('/admin/reagents')
        return { success: true }
    } catch (error) {
        console.error('Failed to update reagent:', error)
        return { success: false, error: 'Failed to update reagent' }
    }
}

export async function deleteReagent(id: string) {
    const currentUser = await requireAdmin()
    try {
        // Check if reagent is used in any usage logs
        const usageCount = await prisma.usageLog.count({
            where: { reagentId: id },
        })

        if (usageCount > 0) {
            return {
                success: false,
                error: `この試薬は${usageCount}件の利用履歴で使用されているため削除できません`
            }
        }

        const reagent = await prisma.reagent.delete({
            where: { id },
        })
        await recordAuditLog({ actor: currentUser, action: 'REAGENT_DELETE', targetType: 'Reagent', targetId: id, targetLabel: reagent.name, summary: '有料サービスを削除しました。' })

        revalidatePath('/admin/reagents')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete reagent:', error)
        return { success: false, error: 'Failed to delete reagent' }
    }
}
