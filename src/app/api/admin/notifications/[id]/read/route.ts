import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
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

        const { id } = await context.params
        const notification = await prisma.adminNotification.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!notification) {
            return apiErrorResponse(404, API_ERROR_CODES.NOT_FOUND, '通知が見つかりません。', '画面を更新して、もう一度お試しください。', requestId)
        }

        await prisma.adminNotificationRead.upsert({
            where: {
                notificationId_adminId: {
                    notificationId: id,
                    adminId: currentUser!.id,
                },
            },
            create: { notificationId: id, adminId: currentUser!.id },
            update: { readAt: new Date() },
        })

        await recordAuditLog({
            actor: currentUser,
            action: 'ADMIN_NOTIFICATION_READ',
            targetType: 'AdminNotification',
            targetId: id,
            summary: '管理者通知を確認済みにしました。',
        })

        return apiSuccessResponse({ success: true }, requestId)
    } catch {
        console.error(`[${requestId}] 管理者通知の既読化に失敗しました。`)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '通知を確認済みにできませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
