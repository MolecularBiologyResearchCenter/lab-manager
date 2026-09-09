'use server'

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/mail'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
    clearSessionCookie,
    getAuthenticatedUser,
    requireAdmin,
    requireCenterDirector,
    requireUser,
    setSessionCookie,
} from '@/lib/auth'
import {
    createPasswordResetToken,
    consumePasswordResetToken,
    hashPassword,
    isPasswordHash,
    validatePassword,
    verifyPassword,
} from '@/lib/password'

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
    const currentUser = await requireUser()
    const now = new Date()
    const currentQuarter = getCurrentQuarter(now)
    const { start: startOfQuarter, end: endOfQuarter } = getQuarterDates(now.getFullYear(), currentQuarter)

    // Get total cost for current quarter
    const usageLogs = await prisma.usageLog.findMany({
        where: {
            userId: currentUser.id,
            date: {
                gte: startOfQuarter,
                lte: endOfQuarter,
            },
        },
        select: {
            id: true,
            userId: true,
            reagentId: true,
            quantity: true,
            totalCost: true,
            date: true,
            reagent: { select: { id: true, name: true, unitPrice: true } },
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
            userId: currentUser.id,
            startTime: {
                gte: startOfDay,
            },
        },
        select: {
            id: true,
            equipmentId: true,
            userId: true,
            startTime: true,
            endTime: true,
            phoneNumber: true,
            equipment: { select: { id: true, name: true, icon: true } },
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
    await requireUser()
    return await prisma.equipment.findMany()
}

export async function getReagentList() {
    await requireUser()
    const reagents = await prisma.reagent.findMany()
    const nameCollator = new Intl.Collator('ja', {
        numeric: true,
        sensitivity: 'base',
    })

    return reagents.sort((a, b) => nameCollator.compare(a.name, b.name))
}

export async function createReservation(equipmentId: string, userId: string, startTime: Date, endTime: Date, phoneNumber?: string) {
    const currentUser = await requireUser()
    if (currentUser.id !== userId) throw new Error('他のユーザーの予約は作成できません。')
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
    const currentUser = await requireUser()
    if (currentUser.id !== userId) throw new Error('他のユーザーの利用記録は作成できません。')
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
    await requireAdmin()
    return prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
            department: true,
            laboratory: true,
            extension: true,
            createdAt: true,
        },
    })
}

export async function updateReservation(
    id: string,
    equipmentId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
    phoneNumber?: string
) {
    const currentUser = await requireUser()
    const existingReservation = await prisma.reservation.findUnique({
        where: { id },
        select: { userId: true },
    })
    if (!existingReservation || (existingReservation.userId !== currentUser.id && currentUser.role !== 'ADMIN')) {
        throw new Error('この予約を変更する権限がありません。')
    }
    if (currentUser.role !== 'ADMIN' && userId !== currentUser.id) {
        throw new Error('予約者を変更する権限がありません。')
    }
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
    const currentUser = await requireUser()
    const reservation = await prisma.reservation.findUnique({
        where: { id },
        select: { userId: true },
    })
    if (!reservation || (reservation.userId !== currentUser.id && currentUser.role !== 'ADMIN')) {
        throw new Error('この予約を削除する権限がありません。')
    }
    await prisma.reservation.delete({
        where: { id },
    })

    revalidatePath('/reservations')
    revalidatePath('/')
    revalidatePath('/admin')
}

export async function getCurrentUser() {
    return getAuthenticatedUser()
}

export async function getCurrentUserSealImage() {
    const currentUser = await requireCenterDirector()
    const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { sealImage: true },
    })
    return user?.sealImage ?? null
}

export async function login(formData: FormData) {
    const email = (formData.get('email') as string).trim()
    const password = (formData.get('password') as string).trim()
    const rememberMe = formData.get('rememberMe') === 'on'

    if (!email || !password) {
        throw new Error('メールアドレスとパスワードを入力してください。')
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true },
    })

    if (!user || !(await verifyPassword(password, user.password))) {
        throw new Error('メールアドレスまたはパスワードが間違っています。')
    }

    if (!isPasswordHash(user.password)) {
        await prisma.user.update({
            where: { id: user.id },
            data: { password: await hashPassword(password) },
        })
    }

    await setSessionCookie(user.id, rememberMe)

    redirect('/')
}

export async function logout() {
    await clearSessionCookie()
    redirect('/login')
}

export async function register(formData: FormData) {
    const lastName = formData.get('lastName') as string
    const firstName = formData.get('firstName') as string
    const lastNameKana = formData.get('lastNameKana') as string
    const firstNameKana = formData.get('firstNameKana') as string
    const employeeId = formData.get('employeeId') as string
    const mailingList = formData.get('mailingList') === 'true' // Convert string to boolean
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const department = formData.get('department') as string
    const laboratory = formData.get('laboratory') as string
    const extension = formData.get('extension') as string

    if (!lastName || !firstName || !lastNameKana || !firstNameKana || !employeeId || !email || !password || !department || !laboratory) {
        throw new Error('必須項目を入力してください。')
    }

    // Password validation: at least 8 characters, alphanumeric
    if (!validatePassword(password)) {
        throw new Error('パスワードは英小文字と数字を含む8文字以上で入力してください。')
    }

    const name = `${lastName} ${firstName}`
    const nameKana = `${lastNameKana} ${firstNameKana}`

    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    })

    if (existingUser) {
        throw new Error('このメールアドレスは既に登録されています。')
    }

    const user = await prisma.user.create({
        data: {
            name,
            nameKana,
            employeeId,
            mailingList,
            email,
            password: await hashPassword(password),
            department,
            laboratory,
            extension,
        },
        select: { id: true },
    })

    await setSessionCookie(user.id)

    redirect('/')
}

export async function remindPassword(formData: FormData) {
    const email = formData.get('email') as string
    const employeeId = formData.get('employeeId') as string

    const genericMessage = '入力内容が登録情報と一致する場合、パスワード再設定メールを送信しました。'
    if (!email || !employeeId) return { message: genericMessage }

    const user = await prisma.user.findFirst({
        where: {
            email,
            employeeId,
        },
        select: { id: true, name: true, email: true },
    })

    if (!user) return { message: genericMessage }

    const { token, tokenHash, expiresAt } = createPasswordResetToken()
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordResetTokenHash: tokenHash,
            passwordResetTokenExpiresAt: expiresAt,
        },
    })

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`

    try {
        await sendEmail({
            to: email,
            subject: '【分子生物実験センター】パスワード再設定',
            text: `${user.name} 様\n\nパスワード再設定の申請を受け付けました。\n次のURLは30分間、一度だけ有効です。\n\n${resetUrl}\n\n申請に心当たりがない場合は、このメールを破棄してください。`,
        })
    } catch {
        console.error('Failed to send credential reset email')
    }

    return { message: genericMessage }
}

export async function resetPassword(token: string, newPassword: string) {
    if (!token || !validatePassword(newPassword)) {
        throw new Error('再設定リンクが無効か期限切れです。')
    }

    await consumePasswordResetToken(
        token,
        newPassword,
        (update) => prisma.user.updateMany(update),
    )
}

export async function deleteUser(userId: string) {
    const currentUser = await requireAdmin()

    // Prevent self-deletion
    if (currentUser.id === userId) {
        throw new Error('自分自身を削除することはできません。')
    }

    // Delete the user
    await prisma.user.delete({
        where: { id: userId },
    })

    revalidatePath('/admin/users')
}

export async function updateProfile(
    userId: string,
    data: {
        department?: string
        laboratory?: string
        extension?: string
        currentPassword?: string
        newPassword?: string
    }
) {
    const currentUser = await requireUser()

    if (currentUser.id !== userId) {
        throw new Error('他のユーザーのプロフィールは変更できません。')
    }

    // Prepare update data
    const updateData: any = {}
    if (data.department !== undefined) updateData.department = data.department
    if (data.laboratory !== undefined) updateData.laboratory = data.laboratory
    if (data.extension !== undefined) updateData.extension = data.extension

    // Handle password change
    if (data.newPassword) {
        if (!data.currentPassword) {
            throw new Error('現在のパスワードを入力してください。')
        }

        const credentials = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { password: true },
        })
        if (!credentials || !(await verifyPassword(data.currentPassword, credentials.password))) {
            throw new Error('現在のパスワードが間違っています。')
        }

        // Password validation
        if (!validatePassword(data.newPassword)) {
            throw new Error('パスワードは英小文字と数字を含む8文字以上で入力してください。')
        }

        updateData.password = await hashPassword(data.newPassword)
    }

    await prisma.user.update({
        where: { id: userId },
        data: updateData,
    })

    revalidatePath('/mypage')
}

export async function sealInvoice(invoiceId: string) {
    const currentUser = await requireCenterDirector()

    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true },
    })

    if (!invoice) {
        throw new Error('請求書が見つかりません。')
    }

    await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            sealedBy: currentUser.id,
            sealedAt: new Date(),
        },
    })

    revalidatePath(`/invoices/${invoiceId}`)
    revalidatePath('/invoices')
}

export async function updateUserRole(userId: string, role: string) {
    const currentUser = await requireAdmin()

    if (!['USER', 'ADMIN', 'CENTER_DIRECTOR'].includes(role)) {
        throw new Error('無効な権限です。')
    }

    // Prevent self-demotion from ADMIN (optional, but good practice)
    if (currentUser.id === userId && role !== 'ADMIN') {
        throw new Error('自分自身の管理者権限を外すことはできません。')
    }

    await prisma.user.update({
        where: { id: userId },
        data: { role },
    })

    revalidatePath('/admin/users')
}

export async function adminSetUserPassword(userId: string, newPassword: string) {
    await requireAdmin()
    if (!validatePassword(newPassword)) {
        throw new Error('パスワードは英小文字と数字を含む8文字以上で入力してください。')
    }
    await prisma.user.update({
        where: { id: userId },
        data: {
            password: await hashPassword(newPassword),
            passwordResetTokenHash: null,
            passwordResetTokenExpiresAt: null,
        },
    })
}

export async function uploadSeal(formData: FormData) {
    const currentUser = await requireCenterDirector()

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
        throw new Error('ファイルが選択されていません。')
    }

    if (!file.type.startsWith('image/')) {
        throw new Error('画像ファイルを選択してください。')
    }

    const maxFileSize = 1024 * 1024
    if (file.size > maxFileSize) {
        throw new Error('画像ファイルは1MB以下にしてください。')
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const sealImage = `data:${file.type};base64,${base64}`

    await prisma.user.update({
        where: { id: currentUser.id },
        data: { sealImage },
    })

    revalidatePath('/')
}
