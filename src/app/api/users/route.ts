import { prisma } from '@/lib/prisma'
import { adminUserSelect, getAuthenticatedUser } from '@/lib/auth'
import { authorizationStatus } from '@/lib/authorization'
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

        const users = await prisma.user.findMany({
            select: adminUserSelect,
            orderBy: {
                createdAt: 'desc',
            },
        })

        return apiSuccessResponse(users, requestId)
    } catch (error) {
        console.error(`[${requestId}] 利用者一覧の取得に失敗しました。`, error)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '利用者一覧を取得できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
