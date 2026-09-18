import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { API_ERROR_CODES, apiErrorResponse, apiHeaders, createRequestId } from '@/lib/api-response'

export const runtime = 'nodejs'

const MAX_PDF_SIZE = 10 * 1024 * 1024

function safeFilenamePart(value: string) {
    return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '利用者'
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId()
    try {
        const user = await getCurrentUser()
        if (!user) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)

        const { id } = await params
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '請求書IDが指定されていません。', '請求書画面からもう一度ダウンロードしてください。', requestId)
        }
        if (!body || typeof body !== 'object' || !('invoiceId' in body) || body.invoiceId !== id) {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '請求書IDが正しくありません。', '請求書画面からもう一度ダウンロードしてください。', requestId)
        }

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                invoiceNumber: true,
                sealedAt: true,
                sealedBy: true,
                fiscalYear: true,
                quarter: true,
                totalAmount: true,
                budgetDepartment: true,
                budgetCategory: true,
                budgetCode: true,
                user: { select: { name: true, department: true, laboratory: true } },
                items: {
                    select: { date: true, itemName: true, unitPrice: true, quantity: true, amount: true },
                    orderBy: { date: 'asc' },
                },
                sealer: { select: { name: true, sealImage: true } },
            },
        })
        if (!invoice) return apiErrorResponse(404, API_ERROR_CODES.NOT_FOUND, '請求書が見つかりません。', '請求書一覧から対象を選び直してください。', requestId)

        const isPrivileged = user.role === 'ADMIN' || user.role === 'CENTER_DIRECTOR'
        if (invoice.userId !== user.id && !isPrivileged) return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この請求書をダウンロードする権限がありません。', '自分の請求書を選ぶか、管理者へ確認してください。', requestId)
        if (!invoice.sealedAt || !invoice.sealedBy || !invoice.sealer) return apiErrorResponse(409, API_ERROR_CODES.CONFLICT, '押印済み請求書のみダウンロードできます。', 'センター長の押印完了後に、もう一度お試しください。', requestId)

        const buffer = await generateInvoicePdf({
            invoiceNumber: invoice.invoiceNumber,
            fiscalYear: invoice.fiscalYear,
            quarter: invoice.quarter,
            totalAmount: invoice.totalAmount,
            budgetDepartment: invoice.budgetDepartment,
            budgetCategory: invoice.budgetCategory,
            budgetCode: invoice.budgetCode,
            user: invoice.user,
            items: invoice.items,
            sealedAt: invoice.sealedAt,
            sealer: invoice.sealer,
        })
        if (buffer.length === 0 || buffer.length > MAX_PDF_SIZE) return apiErrorResponse(413, API_ERROR_CODES.INVALID_REQUEST, '生成されたPDFが10MBを超えています。', '請求書の項目や画像を減らして、もう一度お試しください。', requestId)

        const pdfSha256 = createHash('sha256').update(buffer).digest('hex')
        const executedAt = new Date()
        await prisma.auditLog.create({
            data: {
                actorId: user.id,
                actorName: user.name,
                actorRole: user.role,
                action: 'invoice.pdf_download',
                targetType: 'Invoice',
                targetId: invoice.id,
                targetLabel: invoice.invoiceNumber,
                summary: '押印済みPDF取得',
                metadata: {
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    downloadedBy: user.name,
                    sealerName: invoice.sealer.name,
                    sealedAt: invoice.sealedAt.toISOString(),
                    executedAt: executedAt.toISOString(),
                    fileSize: buffer.length,
                    pdfSha256,
                },
            },
        })

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`請求書_${invoice.fiscalYear}年_${invoice.quarter}期_${safeFilenamePart(invoice.user.name)}.pdf`)}`,
                ...apiHeaders(requestId),
            },
        })
    } catch {
        console.error(`[${requestId}] 押印済み請求書PDFの生成に失敗しました。`)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '押印済みPDFを取得できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
