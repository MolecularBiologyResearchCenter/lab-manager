import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/app/actions'
import { getCurrentQuarter, getQuarterDates } from '@/lib/invoice'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'

export async function GET() {
    const requestId = createRequestId()
    try {
        const user = await getCurrentUser()
        if (!user) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)

        const now = new Date()
        const currentQuarter = getCurrentQuarter(now)
        const { start, end } = getQuarterDates(now.getFullYear(), currentQuarter)

        const usageLogs = await prisma.usageLog.findMany({
            where: {
                userId: user.id,
                date: {
                    gte: start,
                    lte: end,
                },
            },
            select: {
                id: true,
                date: true,
                quantity: true,
                totalCost: true,
                reagent: { select: { id: true, name: true, unitPrice: true } },
            },
            orderBy: { date: 'desc' },
        })

        return apiSuccessResponse(usageLogs, requestId)
    } catch (error) {
        console.error(`[${requestId}] 利用履歴の取得に失敗しました。`, error)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '利用履歴を取得できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
