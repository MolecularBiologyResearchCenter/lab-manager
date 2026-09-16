import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { createInvoicePdf } from '@/lib/invoice-pdf'
import { API_ERROR_CODES, apiErrorResponse, apiHeaders, createRequestId } from '@/lib/api-response'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId()
    try {
        const user = await getCurrentUser()
        if (!user) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        const { id } = await params
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                userId: true, fiscalYear: true, quarter: true, totalAmount: true,
                user: { select: { name: true, department: true, laboratory: true } },
                items: { select: { date: true, itemName: true, unitPrice: true, quantity: true, amount: true }, orderBy: { date: 'asc' } },
                sealer: { select: { name: true, sealImage: true } },
            },
        })
        if (!invoice) return apiErrorResponse(404, API_ERROR_CODES.NOT_FOUND, '請求書が見つかりません。', '請求書一覧から対象を選び直してください。', requestId)
        if (invoice.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR') return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この請求書を閲覧する権限がありません。', '自分の請求書を選ぶか、管理者へ確認してください。', requestId)
        const pdf = await createInvoicePdf(invoice)
        return new NextResponse(pdf as any, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="invoice.pdf"', ...apiHeaders(requestId) } })
    } catch (error) {
        console.error(`[${requestId}] 請求書PDFの生成に失敗しました。`, error)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '請求書PDFを生成できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
