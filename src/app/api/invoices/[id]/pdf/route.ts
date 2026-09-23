import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { API_ERROR_CODES, apiErrorResponse, apiHeaders, createRequestId } from '@/lib/api-response'
import { recordAuditLog } from '@/lib/audit'
import { sha256Pdf, validateGeneratedInvoicePdf } from '@/lib/invoice-pdf-security'

export const runtime = 'nodejs'

function safeFilenamePart(value: string) {
    return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '利用者'
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId()
    let actor: { id: string; name: string; role: string } | null = null
    let targetId: string | null = null

    const failure = async (status: number, code: typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES], error: string, guidance: string) => {
        await recordAuditLog({
            actor,
            action: 'INVOICE_PDF_DOWNLOAD',
            targetType: 'Invoice',
            targetId,
            summary: '押印済みPDF取得に失敗しました。',
            metadata: { requestId, result: 'failure', reason: code },
        })
        return apiErrorResponse(status, code, error, guidance, requestId)
    }

    try {
        const user = await getCurrentUser()
        if (user) actor = { id: user.id, name: user.name, role: user.role }
        if (!user) return failure(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。')

        const { id } = await params
        targetId = id
        if (!id || id.length > 64) return failure(400, API_ERROR_CODES.INVALID_REQUEST, '請求書IDが正しくありません。', '請求書画面からもう一度ダウンロードしてください。')

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                invoiceNumber: true,
                sealedAt: true,
                sealedBy: true,
                status: true,
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
                sealer: { select: { name: true, role: true, sealImage: true } },
            },
        })
        if (!invoice) return failure(404, API_ERROR_CODES.NOT_FOUND, '請求書が見つかりません。', '請求書一覧から対象を選び直してください。')

        const isPrivileged = user.role === 'ADMIN' || user.role === 'CENTER_DIRECTOR'
        if (invoice.userId !== user.id && !isPrivileged) return failure(403, API_ERROR_CODES.FORBIDDEN, 'この請求書をダウンロードする権限がありません。', '自分の請求書を選ぶか、管理者へ確認してください。')
        if (invoice.status === 'rejected') return failure(409, API_ERROR_CODES.CONFLICT, 'この請求書は現在ダウンロードできません。', '請求書の状態を確認して、もう一度お試しください。')
        if (!invoice.sealedAt || !invoice.sealedBy || !invoice.sealer || invoice.sealer.role !== 'CENTER_DIRECTOR') return failure(409, API_ERROR_CODES.CONFLICT, '押印済み請求書のみダウンロードできます。', 'センター長の押印完了後に、もう一度お試しください。')

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
        try {
            validateGeneratedInvoicePdf(buffer)
        } catch (error) {
            const reason = error instanceof Error && error.message === 'PDF_TOO_LARGE'
                ? '生成されたPDFが10MBを超えています。'
                : '請求書PDFを生成できませんでした。'
            return failure(error instanceof Error && error.message === 'PDF_TOO_LARGE' ? 413 : 500, API_ERROR_CODES.INVALID_REQUEST, reason, '時間をおいて、もう一度お試しください。')
        }

        const pdfSha256 = sha256Pdf(buffer)
        const sealAudit = await prisma.auditLog.findFirst({
            where: {
                action: 'INVOICE_SEAL',
                targetType: 'Invoice',
                targetId: invoice.id,
            },
            orderBy: { createdAt: 'desc' },
            select: { metadata: true },
        })
        const sealMetadata = sealAudit?.metadata && typeof sealAudit.metadata === 'object' && !Array.isArray(sealAudit.metadata)
            ? sealAudit.metadata as Record<string, unknown>
            : null
        if (sealMetadata?.result !== 'success' || sealMetadata.pdfSha256 !== pdfSha256 || sealMetadata.fileSize !== buffer.length) {
            return failure(409, API_ERROR_CODES.CONFLICT, '押印対象と請求書の内容が一致しません。', '請求書を再読み込みして、もう一度お試しください。')
        }

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
                    downloadedBy: user.id,
                    sealerId: invoice.sealedBy,
                    sealedAt: invoice.sealedAt.toISOString(),
                    executedAt: executedAt.toISOString(),
                    fileSize: buffer.length,
                    pdfSha256,
                    result: 'success',
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
        return failure(500, API_ERROR_CODES.INTERNAL_ERROR, '押印済みPDFを取得できませんでした。', '時間をおいて、もう一度お試しください。')
    }
}

export async function POST() {
    const requestId = createRequestId()
    return apiErrorResponse(
        405,
        API_ERROR_CODES.INVALID_REQUEST,
        'PDFファイルのアップロードによる押印は利用できません。',
        '請求書画面から、押印済み請求書のPDFを取得してください。',
        requestId,
    )
}
