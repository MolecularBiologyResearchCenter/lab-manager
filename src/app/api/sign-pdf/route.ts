import { NextRequest, NextResponse } from 'next/server'
import signpdf, { plainAddPlaceholder } from 'node-signpdf'
import fs from 'fs'
import path from 'path'
import { getAuthenticatedUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        const currentUser = await getAuthenticatedUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (currentUser.role !== 'CENTER_DIRECTOR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        // Add placeholder for signature
        // Note: jspdf generated PDFs might not have enough space or structure for simple appending?
        // Actually node-signpdf requires a placeholder to be present or added.
        // using plainAddPlaceholder from node-signpdf helpers.

        const pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: buffer,
            reason: 'Digital Signature (Approved)',
            contactInfo: 'center-director@example.com',
            name: 'MBR Center Director',
            location: 'Tokyo, Japan',
        })

        // Load certificate
        const p12Path = path.join(process.cwd(), 'certificate.p12')
        if (!fs.existsSync(p12Path)) {
            console.warn('Certificate file certificate.p12 not found on server')
            return NextResponse.json({ error: 'Certificate file not found' }, { status: 500 })
        }
        const p12Buffer = fs.readFileSync(p12Path)
        const passphrase = process.env.PDF_SIGNING_PASSPHRASE
        if (!passphrase) {
            return NextResponse.json({ error: 'Signing is not configured' }, { status: 500 })
        }

        // Sign
        const signedPdf = signpdf.sign(pdfWithPlaceholder, p12Buffer, { passphrase })

        return new NextResponse(signedPdf as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="signed_invoice.pdf"',
            },
        })
    } catch (error) {
        console.error('Signing error:', error)
        return NextResponse.json({ error: 'Failed to sign PDF' }, { status: 500 })
    }
}
