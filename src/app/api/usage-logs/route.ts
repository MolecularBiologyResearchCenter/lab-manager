import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/app/actions'
import { getCurrentQuarter, getQuarterDates, getTokyoDateParts } from '@/lib/invoice'
import { API_ERROR_CODES, apiErrorResponse, apiSuccessResponse, createRequestId } from '@/lib/api-response'
import { performanceTrace } from '@/lib/performance'

export async function GET() {
    const requestId = createRequestId()
    const trace = performanceTrace('api.usage-logs', requestId)
    try {
        const user = await trace.measure('auth', getCurrentUser)
        if (!user) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)

        const now = new Date()
        const currentQuarter = getCurrentQuarter(now)
        const { start, end } = getQuarterDates(getTokyoDateParts(now).year, currentQuarter)

        const usageLogs = await trace.measure('prismaQuery', () => prisma.usageLog.findMany({
            where: {
                userId: user.id,
                date: {
                    gte: start,
                    lt: end,
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
        }))

        trace.finish()
        return apiSuccessResponse(usageLogs, requestId)
    } catch (error) {
        trace.finish('failure')
        console.error(`[${requestId}] 利用履歴の取得に失敗しました。`, error)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '利用履歴を取得できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
