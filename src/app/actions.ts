'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/mail'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordAuditLog } from '@/lib/audit'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { sha256Pdf, validateGeneratedInvoicePdf } from '@/lib/invoice-pdf-security'
import { formatTokyoDateTime } from '@/lib/date-format'
import {
    checkAuthThrottle,
    getAuthThrottleKeys,
    registerLoginFailure,
    registerPasswordResetRequest,
    resetLoginFailures,
} from '@/lib/auth-rate-limit'
import {
    clearSessionCookie,
    credentialUserSelect,
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
    hashPasswordResetToken,
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

const concurrentReservationError = '同時に別の予約が登録されました。画面を更新して空き状況を確認してください。'
const reservationFailedError = '予約処理中にエラーが発生しました。画面を更新して、もう一度お試しください。'
type ReservationActionResult = { success: true } | { success: false; error: string }
type LoginActionResult = { success: true } | { success: false; error: string }
type RegisterActionResult = { success: true } | { success: false; error: string }

const authAuditActor = { name: '認証システム', role: 'SYSTEM' }
const genericLoginError = 'アカウントまたはパスワードが正しくありません。'

function isTransactionConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
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
            totalCost: true,
            date: true,
            reagent: { select: { name: true } },
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
            startTime: true,
            endTime: true,
            equipment: { select: { name: true } },
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

export async function createReservation(equipmentId: string, userId: string, startTime: Date, endTime: Date, phoneNumber?: string): Promise<ReservationActionResult> {
    const currentUser = await requireUser()
    if (currentUser.id !== userId) throw new Error('他のユーザーの予約は作成できません。')

    try {
        const created = await prisma.$transaction(async (transaction) => {
            const overlap = await transaction.reservation.findFirst({
                where: {
                    equipmentId,
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                },
                select: { id: true },
            })

            if (overlap) return null

            const reservation = await transaction.reservation.create({
                data: { equipmentId, userId, startTime, endTime, ...(phoneNumber ? { phoneNumber } : {}) },
            })
            return reservation.id
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        if (!created) return { success: false, error: 'この時間帯は既に予約が入っています。' }
        await recordAuditLog({
            actor: currentUser,
            action: 'RESERVATION_CREATE',
            targetType: 'Reservation',
            targetId: created,
            targetLabel: `${formatTokyoDateTime(startTime)}～${formatTokyoDateTime(endTime)}`,
            summary: '機器予約を作成しました。',
            metadata: { equipmentId, userId },
        })
    } catch (error) {
        if (isTransactionConflict(error)) return { success: false, error: concurrentReservationError }
        console.error('Failed to create reservation', error)
        return { success: false, error: reservationFailedError }
    }

    revalidatePath('/reservations')
    revalidatePath('/')
    return { success: true }
}

export async function logReagentUsage(userId: string, reagentId: string, quantity: number) {
    const currentUser = await requireUser()
    if (currentUser.id !== userId) throw new Error('他のユーザーの利用記録は作成できません。')
    const reagent = await prisma.reagent.findUnique({
        where: { id: reagentId },
    })

    if (!reagent) throw new Error('Reagent not found')

    const totalCost = reagent.unitPrice * quantity

    const usageLog = await prisma.usageLog.create({
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

    await recordAuditLog({
        actor: currentUser,
        action: 'USAGE_LOG_CREATE',
        targetType: 'UsageLog',
        targetId: usageLog.id,
        targetLabel: reagent.name,
        summary: '有料サービスの利用を記録しました。',
        metadata: { reagentId, quantity, totalCost },
    })

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
): Promise<ReservationActionResult> {
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
    try {
        const updated = await prisma.$transaction(async (transaction) => {
            const overlap = await transaction.reservation.findFirst({
                where: {
                    id: { not: id },
                    equipmentId,
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                },
                select: { id: true },
            })

            if (overlap) return null

            const reservation = await transaction.reservation.update({
                where: { id },
                data: { equipmentId, userId, startTime, endTime, ...(phoneNumber ? { phoneNumber } : {}) },
            })
            return reservation.id
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        if (!updated) return { success: false, error: 'この時間帯は既に予約が入っています。' }
        await recordAuditLog({
            actor: currentUser,
            action: 'RESERVATION_UPDATE',
            targetType: 'Reservation',
            targetId: updated,
            targetLabel: `${formatTokyoDateTime(startTime)}～${formatTokyoDateTime(endTime)}`,
            summary: '機器予約を更新しました。',
            metadata: { equipmentId, userId },
        })
    } catch (error) {
        if (isTransactionConflict(error)) return { success: false, error: concurrentReservationError }
        console.error('Failed to update reservation', error)
        return { success: false, error: reservationFailedError }
    }

    revalidatePath('/reservations')
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true }
}

export async function deleteReservation(id: string) {
    const currentUser = await requireUser()
    const reservation = await prisma.reservation.findUnique({
        where: { id },
        select: { userId: true, equipment: { select: { name: true } }, startTime: true, endTime: true },
    })
    if (!reservation || (reservation.userId !== currentUser.id && currentUser.role !== 'ADMIN')) {
        throw new Error('この予約を削除する権限がありません。')
    }
    await prisma.reservation.delete({
        where: { id },
    })

    await recordAuditLog({
        actor: currentUser,
        action: 'RESERVATION_DELETE',
        targetType: 'Reservation',
        targetId: id,
        targetLabel: reservation.equipment.name,
        summary: '機器予約を削除しました。',
        metadata: { startTime: reservation.startTime.toISOString(), endTime: reservation.endTime.toISOString() },
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

export async function login(formData: FormData): Promise<LoginActionResult | never> {
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '').trim()
    const rememberMe = formData.get('rememberMe') === 'on'

    if (!email || !password) {
        throw new Error('メールアドレスとパスワードを入力してください。')
    }

    try {
        const throttleKeys = await getAuthThrottleKeys(email, 'LOGIN')
        const throttleStatus = await checkAuthThrottle(throttleKeys)
        if (throttleStatus.released) {
            await recordAuditLog({
                actor: authAuditActor,
                action: 'LOGIN_THROTTLE_UNLOCK',
                targetType: 'Authentication',
                summary: 'ログイン試行制限を解除しました。',
            })
        }
        if (throttleStatus.blocked) {
            return { success: false, error: genericLoginError }
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: credentialUserSelect,
        })

        if (!user || !(await verifyPassword(password, user.password))) {
            const locked = await registerLoginFailure(throttleKeys)
            await recordAuditLog({
                actor: authAuditActor,
                action: 'LOGIN_FAILURE',
                targetType: 'Authentication',
                summary: 'ログインに失敗しました。',
            })
            if (locked) {
                await recordAuditLog({
                    actor: authAuditActor,
                    action: 'LOGIN_THROTTLE_LOCK',
                    targetType: 'Authentication',
                    summary: 'ログイン試行制限により一時ロックしました。',
                })
            }
            return { success: false, error: genericLoginError }
        }

        if (!isPasswordHash(user.password)) {
            await prisma.user.update({
                where: { id: user.id },
                data: { password: await hashPassword(password) },
            })
        }

        await setSessionCookie(user.id, rememberMe)
        const wasLimited = await resetLoginFailures(throttleKeys)
        if (wasLimited) {
            await recordAuditLog({
                actor: authAuditActor,
                action: 'LOGIN_THROTTLE_UNLOCK',
                targetType: 'Authentication',
                summary: 'ログイン成功により試行制限を解除しました。',
            })
        }
    } catch {
        console.error('ログイン処理に失敗しました。')
        return { success: false, error: 'ログイン処理中にエラーが発生しました。時間をおいて、もう一度お試しください。' }
    }

    return { success: true }
}

export async function logout() {
    await clearSessionCookie()
    redirect('/login')
}

export async function register(formData: FormData): Promise<RegisterActionResult> {
    const lastName = String(formData.get('lastName') || '').trim()
    const firstName = String(formData.get('firstName') || '').trim()
    const lastNameKana = String(formData.get('lastNameKana') || '').trim()
    const firstNameKana = String(formData.get('firstNameKana') || '').trim()
    const employeeId = String(formData.get('employeeId') || '').trim()
    const mailingList = formData.get('mailingList') === 'true' // Convert string to boolean
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '')
    const department = String(formData.get('department') || '').trim()
    const laboratory = String(formData.get('laboratory') || '').trim()
    const extension = String(formData.get('extension') || '').trim()

    if (!lastName || !firstName || !lastNameKana || !firstNameKana || !employeeId || !email || !password || !department || !laboratory) {
        return { success: false, error: '必須項目を入力してください。' }
    }

    // Password validation: at least 8 characters, alphanumeric
    if (!validatePassword(password)) {
        return { success: false, error: 'パスワードは英小文字と数字を含む8文字以上で入力してください。' }
    }

    const name = `${lastName} ${firstName}`
    const nameKana = `${lastNameKana} ${firstNameKana}`

    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    })

    if (existingUser) {
        return { success: false, error: 'このメールアドレスは既に登録されています。ログイン画面からお試しください。' }
    }

    const passwordHash = await hashPassword(password)
    let user: { id: string }
    try {
        user = await prisma.user.create({
            data: {
                name,
                nameKana,
                employeeId,
                mailingList,
                email,
                password: passwordHash,
                department,
                laboratory,
                extension,
            },
            select: { id: true },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return { success: false, error: 'このメールアドレスは既に登録されています。ログイン画面からお試しください。' }
        }
        throw error
    }

    // 通知の作成失敗で、利用者登録そのものをロールバックしない。
    // 通知テーブルのマイグレーション未反映や一時的なDB障害があっても、
    // 登録済み利用者がログインできなくなることを防ぐ。
    try {
        let notification: { id: string }
        try {
            notification = await prisma.adminNotification.upsert({
                where: { dedupeKey: `NEW_USER_REGISTRATION:${user.id}` },
                create: {
                    type: 'NEW_USER_REGISTRATION',
                    targetUserId: user.id,
                    name,
                    department,
                    laboratory,
                    employeeId,
                    dedupeKey: `NEW_USER_REGISTRATION:${user.id}`,
                },
                update: {},
                select: { id: true },
            })
        } catch (error) {
            // Preview DBへdedupeKeyマイグレーションが未適用でも通知を止めない。
            if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2022')) throw error
            const existing = await prisma.adminNotification.findFirst({
                where: { type: 'NEW_USER_REGISTRATION', targetUserId: user.id },
                select: { id: true },
            })
            notification = existing ?? await prisma.adminNotification.create({
                data: { type: 'NEW_USER_REGISTRATION', targetUserId: user.id, name, department, laboratory, employeeId },
                select: { id: true },
            })
        }
        await recordAuditLog({
            action: 'ADMIN_NOTIFICATION_CREATE',
            targetType: 'AdminNotification',
            targetId: notification.id,
            summary: '新規利用者登録の管理者通知を作成しました。',
        })
    } catch {
        await recordAuditLog({
            action: 'ADMIN_NOTIFICATION_CREATE_FAILURE',
            targetType: 'AdminNotification',
            targetId: user.id,
            summary: '新規利用者登録時の管理者通知作成に失敗しました。',
        })
        console.error('新規利用者登録通知の作成に失敗しました。登録処理は完了しています。')
    }

    await setSessionCookie(user.id)

    redirect('/')
}

export async function remindPassword(formData: FormData) {
    const email = String(formData.get('email') || '').trim()
    const employeeId = String(formData.get('employeeId') || '').trim()

    const genericMessage = '入力内容が登録情報と一致する場合、パスワード再設定メールを送信しました。'
    if (!email || !employeeId) return { message: genericMessage }

    try {
        const throttleKeys = await getAuthThrottleKeys(email, 'PASSWORD_RESET')
        const throttle = await registerPasswordResetRequest(throttleKeys)
        if (throttle.released) {
            await recordAuditLog({
                actor: authAuditActor,
                action: 'PASSWORD_RESET_THROTTLE_UNLOCK',
                targetType: 'Authentication',
                summary: 'パスワード再設定要求の制限を解除しました。',
            })
        }
        if (!throttle.allowed) {
            if (throttle.newlyLocked) {
                await recordAuditLog({
                    actor: authAuditActor,
                    action: 'PASSWORD_RESET_THROTTLE_LOCK',
                    targetType: 'Authentication',
                    summary: 'パスワード再設定要求を一時制限しました。',
                })
            }
            return { message: genericMessage }
        }

        const user = await prisma.user.findFirst({
            where: { email, employeeId },
            select: { id: true, name: true, email: true },
        })

        if (!user) {
            await recordAuditLog({
                actor: authAuditActor,
                action: 'PASSWORD_RESET_REQUEST',
                targetType: 'Authentication',
                summary: 'パスワード再設定要求を受け付けました。',
            })
            return { message: genericMessage }
        }

        const { token, tokenHash, expiresAt } = createPasswordResetToken()
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: expiresAt },
        })

        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`
        await sendEmail({
            to: email,
            subject: '【分子生物実験センター】パスワード再設定',
            text: `${user.name} 様\n\nパスワード再設定の申請を受け付けました。\n次のURLは30分間、一度だけ有効です。\n\n${resetUrl}\n\n申請に心当たりがない場合は、このメールを破棄してください。`,
        })
        await recordAuditLog({
            actor: authAuditActor,
            action: 'PASSWORD_RESET_REQUEST',
            targetType: 'User',
            targetId: user.id,
            summary: 'パスワード再設定要求を受け付けました。',
        })
    } catch {
        console.error('パスワード再設定メールの処理に失敗しました。')
    }

    return { message: genericMessage }
}

export async function resetPassword(token: string, newPassword: string) {
    if (!token || !validatePassword(newPassword)) {
        throw new Error('再設定リンクが無効か期限切れです。')
    }

    const tokenHash = hashPasswordResetToken(token)
    const targetUser = await prisma.user.findFirst({
        where: { passwordResetTokenHash: tokenHash },
        select: { id: true },
    })

    try {
        await consumePasswordResetToken(token, newPassword, (update) => prisma.user.updateMany(update))
    } catch (error) {
        await recordAuditLog({
            actor: authAuditActor,
            action: 'PASSWORD_RESET_FAILURE',
            targetType: 'Authentication',
            summary: 'パスワード再設定に失敗しました。',
        })
        throw error
    }

    await recordAuditLog({
        actor: authAuditActor,
        action: 'PASSWORD_RESET_SUCCESS',
        targetType: 'User',
        targetId: targetUser?.id ?? null,
        summary: 'パスワードを再設定しました。',
    })
}

export async function deleteUser(userId: string) {
    const currentUser = await requireAdmin()

    // Prevent self-deletion
    if (currentUser.id === userId) {
        throw new Error('自分自身を削除することはできません。')
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true } })
    if (!targetUser) throw new Error('ユーザーが見つかりません。')

    await prisma.user.delete({
        where: { id: userId },
    })

    await recordAuditLog({
        actor: currentUser,
        action: 'USER_DELETE',
        targetType: 'User',
        targetId: userId,
        targetLabel: targetUser.name,
        summary: 'ユーザーを削除しました。',
        metadata: { email: targetUser.email, role: targetUser.role },
    })

    revalidatePath('/admin/users')
}

export async function updateProfile(
    userId: string,
    data: {
        department?: string
        laboratory?: string
        extension?: string
        mailingList?: boolean
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
    if (data.mailingList !== undefined) {
        if (typeof data.mailingList !== 'boolean') {
            throw new Error('メーリングリスト設定が不正です。')
        }
        updateData.mailingList = data.mailingList
    }

    const previousProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: { mailingList: true },
    })
    if (!previousProfile) {
        throw new Error('ユーザーが見つかりません。')
    }

    // Handle password change
    if (data.newPassword) {
        if (!data.currentPassword) {
            throw new Error('現在のパスワードを入力してください。')
        }

        const credentials = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: credentialUserSelect,
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

    const mailingListChanged = data.mailingList !== undefined && previousProfile.mailingList !== data.mailingList
    await recordAuditLog({
        actor: currentUser,
        action: 'PROFILE_UPDATE',
        targetType: 'User',
        targetId: userId,
        targetLabel: currentUser.name,
        summary: 'プロフィール情報を更新しました。',
        ...(mailingListChanged
            ? { metadata: { mailingList: { previous: previousProfile.mailingList, next: data.mailingList } } }
            : {}),
    })

    revalidatePath('/mypage')
}

export async function sealInvoice(invoiceId: string, requestId?: string) {
    const currentUser = await requireCenterDirector()

    const recordSealFailure = async (reason: string, message: string): Promise<never> => {
        await recordAuditLog({
            actor: currentUser,
            action: 'INVOICE_SEAL',
            targetType: 'Invoice',
            targetId: typeof invoiceId === 'string' && invoiceId.length <= 64 ? invoiceId : null,
            summary: '請求書の押印に失敗しました。',
            metadata: {
                invoiceId: typeof invoiceId === 'string' && invoiceId.length <= 64 ? invoiceId : null,
                ...(requestId ? { requestId } : {}),
                result: 'failure',
                reason,
            },
        })
        throw new Error(message)
    }

    if (typeof invoiceId !== 'string' || invoiceId.length === 0 || invoiceId.length > 64) {
        return recordSealFailure('INVALID_INVOICE_ID', '請求書IDが正しくありません。')
    }

    const director = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { sealImage: true },
    })
    if (!director?.sealImage) {
        return recordSealFailure('SEAL_IMAGE_NOT_REGISTERED', 'センター長の電子印が登録されていないため、押印できません。管理者に電子印の登録を依頼してください。')
    }

    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
            id: true,
            status: true,
            sealedAt: true,
            sealedBy: true,
            invoiceNumber: true,
            fiscalYear: true,
            quarter: true,
            totalAmount: true,
            budgetDepartment: true,
            budgetCategory: true,
            budgetCode: true,
            user: { select: { name: true, department: true, laboratory: true } },
            items: {
                select: { date: true, itemName: true, unitPrice: true, quantity: true, amount: true },
                orderBy: { date: 'asc' },
            },
        },
    })

    if (!invoice) {
        return recordSealFailure('INVOICE_NOT_FOUND', '請求書が見つかりません。')
    }

    if (invoice.status === 'rejected') {
        return recordSealFailure('INVOICE_REJECTED', '却下済みの請求書には押印できません。')
    }

    if (invoice.status !== 'issued') {
        return recordSealFailure('INVALID_INVOICE_STATUS', '発行済みの請求書以外には押印できません。')
    }

    if (invoice.sealedAt || invoice.sealedBy) {
        return recordSealFailure('INVOICE_ALREADY_SEALED', 'この請求書はすでに押印済みです。')
    }

    const sealedAt = new Date()
    let canonicalPdf: Buffer
    try {
        canonicalPdf = await generateInvoicePdf({
            invoiceNumber: invoice.invoiceNumber,
            fiscalYear: invoice.fiscalYear,
            quarter: invoice.quarter,
            totalAmount: invoice.totalAmount,
            budgetDepartment: invoice.budgetDepartment,
            budgetCategory: invoice.budgetCategory,
            budgetCode: invoice.budgetCode,
            user: invoice.user,
            items: invoice.items,
            sealedAt,
            sealer: { name: currentUser.name, sealImage: director.sealImage },
        })
        validateGeneratedInvoicePdf(canonicalPdf)
    } catch (error) {
        const isTooLarge = error instanceof Error && error.message === 'PDF_TOO_LARGE'
        return recordSealFailure(
            isTooLarge ? 'PDF_TOO_LARGE' : 'PDF_GENERATION_FAILED',
            isTooLarge ? '生成されたPDFが10MBを超えています。' : '押印対象PDFを生成できませんでした。時間をおいて、もう一度お試しください。',
        )
    }

    const pdfSha256 = sha256Pdf(canonicalPdf)
    try {
        const result = await prisma.$transaction(async (transaction) => {
            const updated = await transaction.invoice.updateMany({
                where: { id: invoiceId, sealedAt: null, sealedBy: null },
                data: {
                    sealedBy: currentUser.id,
                    sealedAt,
                },
            })

            if (updated.count === 0) return 0

            await transaction.auditLog.create({
                data: {
                    actorId: currentUser.id,
                    actorName: currentUser.name,
                    actorRole: currentUser.role,
                    action: 'INVOICE_SEAL',
                    targetType: 'Invoice',
                    targetId: invoiceId,
                    summary: '請求書に電子印を押しました。',
                    metadata: {
                        invoiceId,
                        ...(requestId ? { requestId } : {}),
                        sealedAt: sealedAt.toISOString(),
                        executedAt: new Date().toISOString(),
                        fileSize: canonicalPdf.length,
                        pdfSha256,
                        result: 'success',
                    },
                },
            })

            return updated.count
        })

        if (result === 0) {
            return recordSealFailure('INVOICE_ALREADY_SEALED', 'この請求書はすでに押印済みです。')
        }
    } catch {
        console.error('請求書の押印処理に失敗しました。')
        return recordSealFailure('TRANSACTION_FAILED', '押印処理に失敗しました。時間をおいて、もう一度お試しください。')
    }

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

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } })
    if (!targetUser) throw new Error('ユーザーが見つかりません。')
    if (targetUser.role === role) return
    await prisma.user.update({
        where: { id: userId },
        data: { role },
    })

    await recordAuditLog({
        actor: currentUser,
        action: 'USER_ROLE_UPDATE',
        targetType: 'User',
        targetId: userId,
        targetLabel: targetUser.name,
        summary: 'ユーザー権限を変更しました。',
        metadata: { previousRole: targetUser.role, newRole: role },
    })

    revalidatePath('/admin/users')
}

export async function updateUserProfileByAdmin(
    userId: string,
    data: {
        role?: string
        employeeId?: string | null
        mailingList?: boolean
    },
) {
    const currentUser = await requireAdmin()

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true, employeeId: true, mailingList: true },
    })
    if (!targetUser) throw new Error('ユーザーが見つかりません。')

    if (data.role !== undefined && !['USER', 'ADMIN', 'CENTER_DIRECTOR'].includes(data.role)) {
        throw new Error('無効な権限です。')
    }
    if (currentUser.id === userId && data.role !== undefined && data.role !== 'ADMIN') {
        throw new Error('自分自身の管理者権限を外すことはできません。')
    }
    if (data.employeeId !== undefined && data.employeeId !== null && typeof data.employeeId !== 'string') {
        throw new Error('職員番号が不正です。')
    }
    if (data.mailingList !== undefined && typeof data.mailingList !== 'boolean') {
        throw new Error('メーリングリスト設定が不正です。')
    }

    const normalizedEmployeeId = data.employeeId === undefined
        ? undefined
        : (data.employeeId?.trim() || null)
    if (normalizedEmployeeId !== undefined && normalizedEmployeeId !== null && normalizedEmployeeId.length > 100) {
        throw new Error('職員番号は100文字以内で入力してください。')
    }

    const nextRole = data.role ?? targetUser.role
    const roleChanged = nextRole !== targetUser.role
    const employeeIdChanged = normalizedEmployeeId !== undefined && normalizedEmployeeId !== targetUser.employeeId
    const mailingListChanged = data.mailingList !== undefined && data.mailingList !== targetUser.mailingList

    if (!roleChanged && !employeeIdChanged && !mailingListChanged) return

    const updateData: { role?: string; employeeId?: string | null; mailingList?: boolean } = {}
    if (roleChanged) updateData.role = nextRole
    if (employeeIdChanged) updateData.employeeId = normalizedEmployeeId
    if (mailingListChanged) updateData.mailingList = data.mailingList

    await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: updateData })

        if (roleChanged) {
            await tx.auditLog.create({
                data: {
                    actorId: currentUser.id,
                    actorName: currentUser.name,
                    actorRole: currentUser.role,
                    action: 'USER_ROLE_UPDATE',
                    targetType: 'User',
                    targetId: userId,
                    targetLabel: targetUser.name,
                    summary: 'ユーザー権限を変更しました。',
                    metadata: { previousRole: targetUser.role, newRole: nextRole },
                },
            })
        }

        if (employeeIdChanged || mailingListChanged) {
            await tx.auditLog.create({
                data: {
                    actorId: currentUser.id,
                    actorName: currentUser.name,
                    actorRole: currentUser.role,
                    action: 'USER_PROFILE_UPDATE',
                    targetType: 'User',
                    targetId: userId,
                    targetLabel: targetUser.name,
                    summary: '管理者がユーザープロフィールを変更しました。',
                    metadata: {
                        ...(employeeIdChanged ? { changedFields: ['employeeId'] } : {}),
                        ...(mailingListChanged
                            ? { mailingList: { previous: targetUser.mailingList, next: data.mailingList } }
                            : {}),
                    },
                },
            })
        }
    })

    revalidatePath('/admin/users')
    revalidatePath('/mypage')
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

    await recordAuditLog({
        actor: currentUser,
        action: 'SEAL_UPLOAD',
        targetType: 'User',
        targetId: currentUser.id,
        targetLabel: currentUser.name,
        summary: '電子印をアップロードしました。',
        metadata: { contentType: file.type, size: file.size },
    })

    revalidatePath('/')
}
