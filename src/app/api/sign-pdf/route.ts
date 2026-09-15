import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import signpdf, { plainAddPlaceholder } from 'node-signpdf'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAuditLog } from '@/lib/audit'

const MAX_PDF_SIZE = 10 * 1024 * 1024

function errorResponse(message: string, status: number) {
    return NextResponse.json({ error: message }, {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
}

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getAuthenticatedUser()
        if (!currentUser) return errorResponse('ログインが必要です。', 401)

        const formData = await request.formData()
        const invoiceId = formData.get('invoiceId')
        const file = formData.get('file')
        if (typeof invoiceId !== 'string' || !invoiceId.trim()) return errorResponse('請求書IDが指定されていません。', 400)
        if (!(file instanceof File)) return errorResponse('PDFファイルが指定されていません。', 400)
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return errorResponse('PDF形式のファイルを指定してください。', 400)
        if (file.size > MAX_PDF_SIZE) return errorResponse('PDFファイルは10MB以下にしてください。', 413)

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
        if (!invoice) return errorResponse('請求書が見つかりません。', 404)

        const isPrivileged = currentUser.role === 'ADMIN' || currentUser.role === 'CENTER_DIRECTOR'
        if (invoice.userId !== currentUser.id && !isPrivileged) return errorResponse('この請求書に署名する権限がありません。', 403)
        if (!invoice.sealedAt || !invoice.sealedBy || !invoice.sealer) return errorResponse('押印済みの請求書のみ電子署名できます。', 409)

        const passphrase = process.env.PDF_CERT_PASSPHRASE
        if (!passphrase) return errorResponse('電子署名の設定が完了していません。', 500)

        const buffer = Buffer.from(await file.arrayBuffer())
        if (buffer.length > MAX_PDF_SIZE || buffer.subarray(0, 5).toString() !== '%PDF-') return errorResponse('有効なPDFファイルを指定してください。', 400)

        const p12Path = path.join(process.cwd(), 'certificate.p12')
        if (!fs.existsSync(p12Path)) {
            console.error('certificate.p12 がサーバー上にありません。')
            return errorResponse('電子署名用証明書が見つかりません。', 500)
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
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) {
        console.error('PDF署名に失敗しました。', error)
        return errorResponse('PDFの電子署名中にエラーが発生しました。', 500)
    }
}
