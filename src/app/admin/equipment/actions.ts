'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import path from 'path'

export async function getEquipment() {
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
    try {
        const iconsDir = path.join(process.cwd(), 'public', 'icons-blue')
        const files = await fs.readdir(iconsDir)
        const icons = files
            .filter(file => file.endsWith('.jpg'))
            .map(file => `/icons-blue/${file}`)

        return { success: true, icons }
    } catch (error) {
        console.error('Failed to fetch icons:', error)
        return { success: false, error: 'Failed to fetch icons', icons: [] }
    }
}

export async function createEquipment(formData: FormData) {
    try {
        const name = formData.get('name') as string
        const description = formData.get('description') as string
        const icon = formData.get('icon') as string

        if (!name) {
            return { success: false, error: 'Invalid input' }
        }

        await prisma.equipment.create({
            data: {
                name,
                description: description || null,
                icon: icon || null,
            },
        })

        revalidatePath('/admin/equipment')
        revalidatePath('/equipment')
        return { success: true }
    } catch (error) {
        console.error('Failed to create equipment:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create equipment' }
    }
}

export async function updateEquipment(id: string, formData: FormData) {
    try {
        const name = formData.get('name') as string
        const description = formData.get('description') as string
        const icon = formData.get('icon') as string

        if (!name) {
            return { success: false, error: 'Invalid input' }
        }

        await prisma.equipment.update({
            where: { id },
            data: {
                name,
                description: description || null,
                icon: icon || null,
            },
        })

        revalidatePath('/admin/equipment')
        revalidatePath('/equipment')
        return { success: true }
    } catch (error) {
        console.error('Failed to update equipment:', error)
        return { success: false, error: 'Failed to update equipment' }
    }
}

export async function deleteEquipment(id: string) {
    try {
        // Check if equipment is used in any reservations
        const reservationCount = await prisma.reservation.count({
            where: { equipmentId: id },
        })

        if (reservationCount > 0) {
            return {
                success: false,
                error: `この機器は${reservationCount}件の予約で使用されているため削除できません`
            }
        }

        await prisma.equipment.delete({
            where: { id },
        })

        revalidatePath('/admin/equipment')
        revalidatePath('/equipment')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete equipment:', error)
        return { success: false, error: 'Failed to delete equipment' }
    }
}

export async function uploadIcon(formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file) {
            return { success: false, error: 'No file uploaded' }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = file.name.replace(/\s+/g, '-') // Replace spaces with hyphens
        const uploadDir = path.join(process.cwd(), 'public', 'icons-blue')
        const filePath = path.join(uploadDir, filename)

        await fs.writeFile(filePath, buffer)

        const iconPath = `/icons-blue/${filename}`
        return { success: true, iconPath }
    } catch (error) {
        console.error('Failed to upload icon:', error)
        return { success: false, error: 'Failed to upload icon' }
    }
}
