'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import path from 'path'
import { requireAdmin } from '@/lib/auth'
import { recordAuditLog, runAuditedOperation } from '@/lib/audit'
import { randomUUID } from 'crypto'

export async function getEquipment() {
    await requireAdmin()
    try {
        const equipment = await prisma.equipment.findMany({
            orderBy: {
                name: 'asc',
            },
        })
        return { success: true, equipment }
    } catch (error) {
        console.error('Failed to fetch equipment:', error)
        return { success: false, error: 'Failed to fetch equipment' }
    }
}

export async function getAvailableIcons() {
    await requireAdmin()
    try {
        const iconsDir = path.join(process.cwd(), 'public', 'icons-blue')
        const files = await fs.readdir(iconsDir)
        const icons = files
            .filter(file => /\.(?:jpg|jpeg|png|webp)$/i.test(file))
            .map(file => `/icons-blue/${file}`)

        return { success: true, icons }
    } catch (error) {
        console.error('Failed to fetch icons:', error)
        return { success: false, error: 'Failed to fetch icons', icons: [] }
    }
}

export async function createEquipment(formData: FormData) {
    return runAuditedOperation('EQUIPMENT_CREATE', 'Equipment', null, async () => {
    const currentUser = await requireAdmin()
    try {
        const name = formData.get('name') as string
        const description = formData.get('description') as string
        const icon = formData.get('icon') as string

        if (!name) {
            return { success: false, error: 'Invalid input' }
        }

        const equipment = await prisma.equipment.create({
            data: {
                name,
                description: description || null,
                icon: icon || null,
            },
        })
        await recordAuditLog({ actor: currentUser, action: 'EQUIPMENT_CREATE', targetType: 'Equipment', targetId: equipment.id, targetLabel: equipment.name, summary: '機器を追加しました。' })

        revalidatePath('/admin/equipment')
        revalidatePath('/equipment')
        return { success: true }
    } catch (error) {
        console.error('Failed to create equipment:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create equipment' }
    }

    })
}

export async function updateEquipment(id: string, formData: FormData) {
    return runAuditedOperation('EQUIPMENT_UPDATE', 'Equipment', id, async () => {
    const currentUser = await requireAdmin()
    try {
        const name = formData.get('name') as string
        const description = formData.get('description') as string
        const icon = formData.get('icon') as string

        if (!name) {
            return { success: false, error: 'Invalid input' }
        }

        const equipment = await prisma.equipment.update({
            where: { id },
            data: {
                name,
                description: description || null,
                icon: icon || null,
            },
        })
        await recordAuditLog({ actor: currentUser, action: 'EQUIPMENT_UPDATE', targetType: 'Equipment', targetId: equipment.id, targetLabel: equipment.name, summary: '機器を更新しました。' })

        revalidatePath('/admin/equipment')
        revalidatePath('/equipment')
        return { success: true }
    } catch (error) {
        console.error('Failed to update equipment:', error)
        return { success: false, error: 'Failed to update equipment' }
    }

    })
}

export async function deleteEquipment(id: string) {
    return runAuditedOperation('EQUIPMENT_DELETE', 'Equipment', id, async () => {
    const currentUser = await requireAdmin()
    try {
        // Check if equipment is used in any reservations
        const reservationCount = await prisma.reservation.count({
            where: { equipmentId: id, status: { notIn: ['cancelled', 'rejected'] } },
        })

        if (reservationCount > 0) {
            return {
                success: false,
                error: `この機器は${reservationCount}件の予約で使用されているため削除できません`
            }
        }

        const equipment = await prisma.equipment.delete({
            where: { id },
        })
        await recordAuditLog({ actor: currentUser, action: 'EQUIPMENT_DELETE', targetType: 'Equipment', targetId: id, targetLabel: equipment.name, summary: '機器を削除しました。' })

        revalidatePath('/admin/equipment')
        revalidatePath('/equipment')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete equipment:', error)
        return { success: false, error: 'Failed to delete equipment' }
    }

    })
}

export async function uploadIcon(formData: FormData) {
    return runAuditedOperation('EQUIPMENT_ICON_UPLOAD', 'EquipmentIcon', null, async () => {
    const currentUser = await requireAdmin()
    try {
        const file = formData.get('file') as File
        if (!(file instanceof File) || file.size === 0) {
            return { success: false, error: 'No file uploaded' }
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
            return { success: false, error: '画像はJPEG、PNG、WebPの2MB以下で指定してください' }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const extension = file.type === 'image/jpeg' ? '.jpg' : file.type === 'image/png' ? '.png' : '.webp'
        const filename = `${randomUUID()}${extension}`
        const uploadDir = path.join(process.cwd(), 'public', 'icons-blue')
        const filePath = path.join(uploadDir, filename)

        await fs.writeFile(filePath, buffer)

        const iconPath = `/icons-blue/${filename}`
        await recordAuditLog({ actor: currentUser, action: 'EQUIPMENT_ICON_UPLOAD', targetType: 'EquipmentIcon', targetLabel: filename, summary: '機器アイコンをアップロードしました。', metadata: { contentType: file.type, size: file.size } })
        return { success: true, iconPath }
    } catch (error) {
        console.error('Failed to upload icon:', error)
        return { success: false, error: 'Failed to upload icon' }
    }

    })
}
