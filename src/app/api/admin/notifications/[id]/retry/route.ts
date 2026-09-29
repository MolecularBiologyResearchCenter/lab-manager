import { getAuthenticatedUser } from '@/lib/auth'
import { recordAuthorizationFailure } from '@/lib/audit'
import { retryDeletedUserMicrosoftGroupSync } from '@/lib/microsoft-group-sync'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'
import { performanceTrace } from '@/lib/performance'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId()
    const trace = performanceTrace('api.admin.notifications.retry', requestId)

    try {
        const currentUser = await trace.measure('auth', getAuthenticatedUser)
        const status = !currentUser
            ? 401
            : currentUser.role === 'ADMIN' || currentUser.role === 'CENTER_DIRECTOR'
                ? null
                : 403
        if (status === 401) {
            return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        }
        if (status === 403) {
            await recordAuthorizationFailure(currentUser, 'ADMIN_OR_CENTER_DIRECTOR')
            return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この操作を行う権限がありません。', '管理者またはセンター長権限でログインしてください。', requestId)
        }

        const { id } = await context.params
        const result = await trace.measure('externalApi', () => retryDeletedUserMicrosoftGroupSync({
            notificationId: id,
            actor: currentUser!,
        }))

        if (!result.ok) {
            trace.finish('failure')
            const message = result.errorCode === 'GRAPH_CONFIG_MISSING'
                ? 'このPreview環境にMicrosoft 365連携設定がありません。VercelのPreview環境変数を確認してください。'
                : '分子生物実験センターグループの削除を再試行できませんでした。'
            return apiErrorResponse(502, API_ERROR_CODES.EXTERNAL_SERVICE, message, '設定を確認してから、もう一度お試しください。', requestId)
        }

        trace.finish()
        return apiSuccessResponse({ success: true, operation: result.ok ? result.operation : null }, requestId)
    } catch (error) {
        trace.finish('failure')
        const unavailable = error instanceof Error && error.message === 'MICROSOFT_GROUP_RETRY_NOT_AVAILABLE'
        return apiErrorResponse(
            unavailable ? 409 : 502,
            unavailable ? API_ERROR_CODES.CONFLICT : API_ERROR_CODES.EXTERNAL_SERVICE,
            unavailable ? 'この通知は再試行できません。' : '分子生物実験センターグループの削除を再試行できませんでした。',
            unavailable ? '通知が解決済みか、再試行に必要な情報がありません。' : '時間をおいて、もう一度お試しください。',
            requestId,
        )
    }
}
