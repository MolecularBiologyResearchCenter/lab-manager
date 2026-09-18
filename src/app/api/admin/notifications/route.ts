import { prisma } from '@/lib/prisma'
import { authorizationStatus } from '@/lib/authorization'
import { getAuthenticatedUser } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'

export async function GET() {
    const requestId = createRequestId()

    try {
        const currentUser = await getAuthenticatedUser()
        const status = authorizationStatus(currentUser, 'ADMIN')
        if (status === 401) {
            return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        }
        if (status === 403) {
            return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この操作を行う権限がありません。', '管理者権限でログインしてください。', requestId)
        }

        const [notifications, unreadCount] = await Promise.all([
            prisma.adminNotification.findMany({
                select: {
                    id: true,
                    type: true,
                    name: true,
                    department: true,
                    laboratory: true,
                    employeeId: true,
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
