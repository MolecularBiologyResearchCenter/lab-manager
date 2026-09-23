import { NextRequest } from 'next/server'
import { getCurrentUser, sealInvoice } from '@/app/actions'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'
import { recordAuditLog } from '@/lib/audit'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId()
    let actor: { id: string; name: string; role: string } | null = null
    let targetId: string | null = null

    try {
        const user = await getCurrentUser()
        if (user) actor = { id: user.id, name: user.name, role: user.role }
        if (!user) {
            return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        }

        if (user.role !== 'CENTER_DIRECTOR') {
            return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この操作を実行する権限がありません。', 'センター長のアカウントで、もう一度お試しください。', requestId)
        }

        const { id } = await params
        targetId = id
        if (!id || id.length > 64) {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '請求書IDが正しくありません。', '請求書画面からもう一度お試しください。', requestId)
        }

        await sealInvoice(id, requestId)
        return apiSuccessResponse({ success: true }, requestId)
    } catch {
        await recordAuditLog({
            actor,
            action: 'INVOICE_SEAL',
            targetType: 'Invoice',
            targetId,
            summary: '請求書の押印APIに失敗しました。',
            metadata: { requestId, result: 'failure', reason: 'API_FAILURE' },
        })
        console.error(`[${requestId}] 請求書の押印APIに失敗しました。`)
        return apiErrorResponse(409, API_ERROR_CODES.CONFLICT, '押印処理に失敗しました。', '請求書の状態を確認して、もう一度お試しください。', requestId)
    }
}

export async function GET() {
    const requestId = createRequestId()
    return apiErrorResponse(405, API_ERROR_CODES.INVALID_REQUEST, 'この操作はPOSTで実行してください。', '請求書画面から押印してください。', requestId)
}
