import { NextRequest } from 'next/server'
import { getCurrentUser, sealInvoices } from '@/app/actions'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'
import { recordAuditLog } from '@/lib/audit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    const requestId = createRequestId()
    let actor: { id: string; name: string; role: string } | null = null

    try {
        const user = await getCurrentUser()
        if (user) actor = { id: user.id, name: user.name, role: user.role }
        if (!user) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        if (user.role !== 'CENTER_DIRECTOR') return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この操作を実行する権限がありません。', 'センター長のアカウントで、もう一度お試しください。', requestId)

        const body = await request.json()
        const invoiceIds = Array.isArray(body?.invoiceIds) ? body.invoiceIds : []
        const result = await sealInvoices(invoiceIds, requestId)
        return apiSuccessResponse(result, requestId)
    } catch (error) {
        await recordAuditLog({
            actor,
            action: 'INVOICE_SEAL',
            targetType: 'Invoice',
            targetId: null,
            summary: '請求書の一括押印APIに失敗しました。',
            metadata: { requestId, result: 'failure', reason: 'BULK_API_FAILURE' },
        })
        const message = error instanceof Error ? error.message : '一括押印に失敗しました。'
        return apiErrorResponse(409, API_ERROR_CODES.CONFLICT, message, '対象請求書を確認して、もう一度お試しください。', requestId)
    }
}
