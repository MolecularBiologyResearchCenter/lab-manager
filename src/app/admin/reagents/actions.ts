'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getReagents() {
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
    try {
        const name = formData.get('name') as string
        const unitPrice = parseFloat(formData.get('unitPrice') as string)

        if (!name || isNaN(unitPrice)) {
            return { success: false, error: 'Invalid input' }
        }

        await prisma.reagent.create({
            data: {
                name,
                unitPrice,
            },
        })

        revalidatePath('/admin/reagents')
        return { success: true }
    } catch (error) {
        console.error('Failed to create reagent:', error)
        return { success: false, error: 'Failed to create reagent' }
    }
}

export async function updateReagent(id: string, formData: FormData) {
    try {
        const name = formData.get('name') as string
        const unitPrice = parseFloat(formData.get('unitPrice') as string)

        if (!name || isNaN(unitPrice)) {
            return { success: false, error: 'Invalid input' }
        }

        await prisma.reagent.update({
            where: { id },
            data: {
                name,
                unitPrice,
            },
        })

        revalidatePath('/admin/reagents')
        return { success: true }
    } catch (error) {
        console.error('Failed to update reagent:', error)
        return { success: false, error: 'Failed to update reagent' }
    }
}

export async function deleteReagent(id: string) {
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

        await prisma.reagent.delete({
            where: { id },
        })

        revalidatePath('/admin/reagents')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete reagent:', error)
        return { success: false, error: 'Failed to delete reagent' }
    }
}
