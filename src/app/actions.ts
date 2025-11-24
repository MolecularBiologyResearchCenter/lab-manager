'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Get the current quarter (1, 2, or 3) based on the month
 * Quarter 1: Jan-Apr (months 0-3)
 * Quarter 2: May-Aug (months 4-7)
 * Quarter 3: Sep-Dec (months 8-11)
 */
function getCurrentQuarter(date: Date): number {
    const month = date.getMonth()
    if (month >= 0 && month <= 3) return 1
    if (month >= 4 && month <= 7) return 2
    return 3
}

/**
 * Get the start and end dates for a given quarter
 */
function getQuarterDates(year: number, quarter: number): { start: Date; end: Date } {
    let startMonth: number
    let endMonth: number

    switch (quarter) {
        case 1:
            startMonth = 0 // January
            endMonth = 3 // April
            break
        case 2:
            startMonth = 4 // May
            endMonth = 7 // August
            break
        case 3:
            startMonth = 8 // September
            endMonth = 11 // December
            break
        default:
            throw new Error('Invalid quarter')
    }

    const start = new Date(year, startMonth, 1)
    const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999)

    return { start, end }
}

export async function getDashboardData() {
    const now = new Date()
    const currentQuarter = getCurrentQuarter(now)
    const { start: startOfQuarter, end: endOfQuarter } = getQuarterDates(now.getFullYear(), currentQuarter)

    // Get total cost for current quarter
    const usageLogs = await prisma.usageLog.findMany({
        where: {
            date: {
                gte: startOfQuarter,
                lte: endOfQuarter,
            },
        },
        include: {
            reagent: true,
            user: true,
        },
        orderBy: {
            date: 'desc',
        },
    })

    const totalCost = usageLogs.reduce((sum: number, log: any) => sum + log.totalCost, 0)

    // Get upcoming reservations (starting from today 00:00)
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const upcomingReservations = await prisma.reservation.findMany({
        where: {
            startTime: {
                gte: startOfDay,
            },
        },
        include: {
            equipment: true,
            user: true,
        },
        orderBy: {
            startTime: 'asc',
        },
        take: 100,
    })

    // Get equipment status (count of active reservations right now)
    const activeReservationsCount = await prisma.reservation.count({
        where: {
            startTime: { lte: now },
            endTime: { gte: now },
        },
    })

    // Generate quarter label
    let quarterLabel = ''
    switch (currentQuarter) {
        case 1:
            quarterLabel = '1-4月'
            break
        case 2:
            quarterLabel = '5-8月'
            break
        case 3:
            quarterLabel = '9-12月'
            break
    }

    return {
        totalCost,
        upcomingReservations,
        activeReservationsCount,
        currentQuarter,
        fiscalYear: now.getFullYear(),
        quarterLabel,
        usageLogs,
    }
}

export async function getEquipmentList() {
    return await prisma.equipment.findMany()
}

export async function getReagentList() {
    return await prisma.reagent.findMany()
}

export async function createReservation(equipmentId: string, userId: string, startTime: Date, endTime: Date, phoneNumber?: string) {
    // Check for overlaps
    const overlap = await prisma.reservation.findFirst({
        where: {
            equipmentId,
            OR: [
                {
                    startTime: { lte: endTime },
                    endTime: { gte: startTime },
                },
            ],
        },
    })

    if (overlap) {
        throw new Error('Reservation overlaps with an existing booking')
    }

    await prisma.reservation.create({
        data: {
            equipmentId,
            userId,
            startTime,
            endTime,
            ...(phoneNumber ? { phoneNumber } : {}),
        },
    })

    revalidatePath('/reservations')
    revalidatePath('/')
}

export async function logReagentUsage(userId: string, reagentId: string, quantity: number) {
    const reagent = await prisma.reagent.findUnique({
        where: { id: reagentId },
    })

    if (!reagent) throw new Error('Reagent not found')

    const totalCost = reagent.unitPrice * quantity

    await prisma.usageLog.create({
        data: {
            userId,
            reagentId,
            quantity,
            totalCost,
        },
    })

    // Update stock if tracked
    if (reagent.stock !== null) {
        await prisma.reagent.update({
            where: { id: reagentId },
            data: { stock: reagent.stock - quantity },
        })
    }

    revalidatePath('/reagents')
    revalidatePath('/')
}

export async function getUsers() {
    return await prisma.user.findMany()
}

export async function updateReservation(
    id: string,
    equipmentId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
    phoneNumber?: string
) {
    // Check for overlapping reservations (excluding the current one)
    const overlap = await prisma.reservation.findFirst({
        where: {
            id: { not: id },
            equipmentId,
            OR: [
                {
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                },
            ],
        },
    })

    if (overlap) {
        throw new Error('この時間帯は既に予約が入っています。')
    }

    await prisma.reservation.update({
        where: { id },
        data: {
            equipmentId,
            userId,
            startTime,
            endTime,
            ...(phoneNumber ? { phoneNumber } : {}),
        },
    })

    revalidatePath('/reservations')
    revalidatePath('/')
    revalidatePath('/admin')
}

export async function deleteReservation(id: string) {
    await prisma.reservation.delete({
        where: { id },
    })

    revalidatePath('/reservations')
    revalidatePath('/')
    revalidatePath('/admin')
}

export async function getCurrentUser() {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) return null

    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    return user
}

export async function login(formData: FormData) {
    const email = (formData.get('email') as string).trim()
    const password = (formData.get('password') as string).trim()

    if (!email || !password) {
        throw new Error('メールアドレスとパスワードを入力してください。')
    }

    const user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user || user.password !== password) {
        throw new Error('メールアドレスまたはパスワードが間違っています。')
    }

    const cookieStore = await cookies()
    cookieStore.set('userId', user.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production' })

    redirect('/')
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.delete('userId')
    redirect('/login')
}

export async function register(formData: FormData) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const department = formData.get('department') as string
    const laboratory = formData.get('laboratory') as string
    const extension = formData.get('extension') as string

    if (!name || !email || !password || !department || !laboratory) {
        throw new Error('必須項目を入力してください。')
    }

    const existingUser = await prisma.user.findUnique({
        where: { email },
    })

    if (existingUser) {
        throw new Error('このメールアドレスは既に登録されています。')
    }

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password,
            department,
            laboratory,
            extension,
        },
    })

    const cookieStore = await cookies()
    cookieStore.set('userId', user.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production' })

    redirect('/')
}
