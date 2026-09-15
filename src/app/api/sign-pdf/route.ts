import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import signpdf, { plainAddPlaceholder } from 'node-signpdf'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAuditLog } from '@/lib/audit'
import { API_ERROR_CODES, apiErrorResponse, apiHeaders, createRequestId } from '@/lib/api-response'

const MAX_PDF_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
    const requestId = createRequestId()
    try {
        const currentUser = await getAuthenticatedUser()
        if (!currentUser) return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)

        const formData = await request.formData()
        const invoiceId = formData.get('invoiceId')
        const file = formData.get('file')
        if (typeof invoiceId !== 'string' || !invoiceId.trim()) return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '請求書IDが指定されていません。', '請求書画面からもう一度お試しください。', requestId)
        if (!(file instanceof File)) return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, 'PDFファイルが指定されていません。', 'PDFファイルを選び直してください。', requestId)
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, 'PDF形式のファイルを指定してください。', 'PDFファイルを選び直してください。', requestId)
        if (file.size > MAX_PDF_SIZE) return apiErrorResponse(413, API_ERROR_CODES.INVALID_REQUEST, 'PDFファイルは10MB以下にしてください。', '10MB以下のPDFを選び直してください。', requestId)

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                id: true,
                userId: true,
                invoiceNumber: true,
                sealedAt: true,
                sealedBy: true,
                sealer: { select: { name: true } },
            },
        })
        if (!invoice) return apiErrorResponse(404, API_ERROR_CODES.NOT_FOUND, '請求書が見つかりません。', '請求書一覧から対象を選び直してください。', requestId)

        const isPrivileged = currentUser.role === 'ADMIN' || currentUser.role === 'CENTER_DIRECTOR'
        if (invoice.userId !== currentUser.id && !isPrivileged) return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この請求書に署名する権限がありません。', '請求書の所有者または管理者へ確認してください。', requestId)
        if (!invoice.sealedAt || !invoice.sealedBy || !invoice.sealer) return apiErrorResponse(409, API_ERROR_CODES.CONFLICT, '押印済みの請求書のみ電子署名できます。', '押印状態を確認してから、もう一度お試しください。', requestId)

        const passphrase = process.env.PDF_CERT_PASSPHRASE
        if (!passphrase) return apiErrorResponse(500, API_ERROR_CODES.CONFIGURATION_ERROR, '電子署名を利用できません。', '管理者へ問い合わせてください。', requestId)

        const buffer = Buffer.from(await file.arrayBuffer())
        if (buffer.length > MAX_PDF_SIZE || buffer.subarray(0, 5).toString() !== '%PDF-') return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '有効なPDFファイルを指定してください。', 'PDFファイルを選び直してください。', requestId)

        const p12Path = path.join(process.cwd(), 'certificate.p12')
        if (!fs.existsSync(p12Path)) {
            console.error(`[${requestId}] certificate.p12 がサーバー上にありません。`)
            return apiErrorResponse(500, API_ERROR_CODES.CONFIGURATION_ERROR, '電子署名を利用できません。', '管理者へ問い合わせてください。', requestId)
        }

        const pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: buffer,
            reason: '請求書への電子署名',
            contactInfo: currentUser.email,
            name: invoice.sealer.name,
            location: '分子生物実験センター',
        })
        const signedPdf = signpdf.sign(pdfWithPlaceholder, fs.readFileSync(p12Path), { passphrase })
        const digest = createHash('sha256').update(buffer).digest('hex')

        await recordAuditLog({
            actor: currentUser,
            action: 'invoice.pdf_download',
            targetType: 'Invoice',
            targetId: invoice.id,
            targetLabel: invoice.invoiceNumber,
            summary: '署名付きPDF取得',
            metadata: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                fileSize: buffer.length,
                pdfSha256: digest,
                sealedAt: invoice.sealedAt.toISOString(),
            },
        })

        return new NextResponse(signedPdf as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="signed_invoice.pdf"',
                ...apiHeaders(requestId),
            },
        })
    } catch (error) {
        console.error(`[${requestId}] PDF署名に失敗しました。`, error)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, 'PDFの電子署名に失敗しました。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
