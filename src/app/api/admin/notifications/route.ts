import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'
import { getActiveInvoiceReminderPeriod, getInvoiceReminderDedupeKey, INVOICE_ISSUE_REMINDER_TYPE } from '@/lib/invoice-reminders'

async function syncInvoiceIssueReminder() {
    const period = getActiveInvoiceReminderPeriod(new Date())
    if (!period) return

    const invoiceWhere = { fiscalYear: period.fiscalYear, quarter: period.quarter }
    const [totalCount, issuedCount] = await Promise.all([
        prisma.invoice.count({ where: invoiceWhere }),
        prisma.invoice.count({ where: { ...invoiceWhere, status: 'issued' } }),
    ])
    const needsReminder = totalCount === 0 || issuedCount < totalCount
    const dedupeKey = getInvoiceReminderDedupeKey(period)
    const existing = await prisma.adminNotification.findUnique({
        where: { dedupeKey },
        select: { id: true, resolvedAt: true },
    })

    if (!needsReminder) {
        if (existing && !existing.resolvedAt) {
            await prisma.adminNotification.update({ where: { id: existing.id }, data: { resolvedAt: new Date() } })
        }
        return
    }

    await prisma.adminNotification.upsert({
        where: { dedupeKey },
        create: {
            type: INVOICE_ISSUE_REMINDER_TYPE,
            targetUserId: null,
            name: '請求書を発行してください',
            fiscalYear: period.fiscalYear,
            quarter: period.quarter,
            dedupeKey,
        },
        update: { resolvedAt: null },
    })

    if (existing?.resolvedAt) {
        await prisma.$transaction([
            prisma.adminNotification.update({ where: { id: existing.id }, data: { resolvedAt: null } }),
            prisma.adminNotificationRead.deleteMany({ where: { notificationId: existing.id } }),
        ])
    }
}

export async function GET() {
    const requestId = createRequestId()

    try {
        const currentUser = await getAuthenticatedUser()
        const status = !currentUser
            ? 401
            : currentUser.role === 'ADMIN' || currentUser.role === 'CENTER_DIRECTOR'
                ? null
                : 403
        if (status === 401) {
            return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        }
        if (status === 403) {
            return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この操作を行う権限がありません。', '管理者またはセンター長権限でログインしてください。', requestId)
        }

        await syncInvoiceIssueReminder()

        const [notifications, unreadCount] = await Promise.all([
            prisma.adminNotification.findMany({
                where: {
                    OR: [
                        { type: { not: INVOICE_ISSUE_REMINDER_TYPE } },
                        { type: INVOICE_ISSUE_REMINDER_TYPE, resolvedAt: null },
                    ],
                },
                select: {
                    id: true,
                    type: true,
                    name: true,
                    department: true,
                    laboratory: true,
                    employeeId: true,
                    fiscalYear: true,
                    quarter: true,
                    createdAt: true,
                    reads: {
                        where: { adminId: currentUser!.id },
                        select: { readAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.adminNotification.count({
                where: {
                    OR: [
                        { type: { not: INVOICE_ISSUE_REMINDER_TYPE } },
                        { type: INVOICE_ISSUE_REMINDER_TYPE, resolvedAt: null },
                    ],
                    reads: { none: { adminId: currentUser!.id } },
                },
            }),
        ])

        await recordAuditLog({
            actor: currentUser,
            action: 'ADMIN_NOTIFICATION_VIEW',
            targetType: 'AdminNotification',
            summary: '管理者通知を閲覧しました。',
            metadata: { notificationCount: notifications.length },
        })

        return apiSuccessResponse({
            unreadCount,
            notifications: notifications.map(({ reads, ...notification }) => ({
                ...notification,
                isRead: reads.length > 0,
            })),
        }, requestId)
    } catch {
        console.error(`[${requestId}] 管理者通知の取得に失敗しました。`)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '管理者通知を取得できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
