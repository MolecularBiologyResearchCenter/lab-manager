import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { API_ERROR_CODES, apiErrorResponse, apiHeaders, createRequestId } from '@/lib/api-response'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

const MAX_PDF_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId()
    try {
        const user = await getCurrentUser()
        if (!user) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)

        const { id } = await params
        const formData = await request.formData()
        const file = formData.get('file')
        if (!(file instanceof File)) return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, 'PDFファイルが指定されていません。', '請求書画面からもう一度ダウンロードしてください。', requestId)
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, 'PDF形式のファイルを指定してください。', '請求書画面からもう一度ダウンロードしてください。', requestId)
        if (file.size > MAX_PDF_SIZE) return apiErrorResponse(413, API_ERROR_CODES.INVALID_REQUEST, 'PDFファイルは10MB以下にしてください。', '請求書の項目数を減らすか、時間をおいて再試行してください。', requestId)

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                invoiceNumber: true,
                sealedAt: true,
                sealedBy: true,
                user: { select: { name: true } },
            },
        })
        if (!invoice) return apiErrorResponse(404, API_ERROR_CODES.NOT_FOUND, '請求書が見つかりません。', '請求書一覧から対象を選び直してください。', requestId)

        const isPrivileged = user.role === 'ADMIN' || user.role === 'CENTER_DIRECTOR'
        if (invoice.userId !== user.id && !isPrivileged) return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この請求書をダウンロードする権限がありません。', '自分の請求書を選ぶか、管理者へ確認してください。', requestId)
        if (!invoice.sealedAt || !invoice.sealedBy) return apiErrorResponse(409, API_ERROR_CODES.CONFLICT, '押印済み請求書のみダウンロードできます。', 'センター長の押印完了後に、もう一度お試しください。', requestId)

        const buffer = Buffer.from(await file.arrayBuffer())
        if (buffer.length === 0 || buffer.subarray(0, 5).toString() !== '%PDF-') return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '有効なPDFファイルを指定してください。', '請求書画面からもう一度ダウンロードしてください。', requestId)

        const pdfSha256 = createHash('sha256').update(buffer).digest('hex')
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
                    userName: invoice.user.name,
                    sealedAt: invoice.sealedAt.toISOString(),
                    fileSize: buffer.length,
                    pdfSha256,
                },
            },
        })

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment',
                ...apiHeaders(requestId),
            },
        })
    } catch (error) {
        console.error(`[${requestId}] 押印済みPDFの取得に失敗しました。`, error)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '押印済みPDFを取得できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
