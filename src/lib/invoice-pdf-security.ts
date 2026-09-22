import { createHash } from 'node:crypto'

export const MAX_INVOICE_PDF_SIZE = 10 * 1024 * 1024

export function validateGeneratedInvoicePdf(pdf: Uint8Array) {
    if (pdf.byteLength === 0) {
        throw new Error('EMPTY_PDF')
    }
    if (pdf.byteLength > MAX_INVOICE_PDF_SIZE) {
        throw new Error('PDF_TOO_LARGE')
    }

    const header = Buffer.from(pdf.subarray(0, 5)).toString('ascii')
    if (header !== '%PDF-') {
        throw new Error('INVALID_PDF')
    }
}

export function sha256Pdf(pdf: Uint8Array) {
    return createHash('sha256').update(pdf).digest('hex')
}
