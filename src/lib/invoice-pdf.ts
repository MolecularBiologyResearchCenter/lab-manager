import PDFDocument from 'pdfkit'
import path from 'path'

type InvoicePdfData = {
    fiscalYear: number
    quarter: number
    totalAmount: number
    user: { name: string; department: string | null; laboratory: string | null }
    items: Array<{ date: Date; itemName: string; unitPrice: number; quantity: number; amount: number }>
    sealer: { name: string; sealImage: string | null } | null
}

const fontPath = path.join(process.cwd(), 'public/fonts/noto-sans-jp-japanese-400-normal.woff2')

function quarterLabel(quarter: number) {
    return quarter === 1 ? '1～4月' : quarter === 2 ? '5～8月' : quarter === 3 ? '9～12月' : `${quarter}期`
}

export function createInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument({ size: 'A4', margin: 42, compress: true })
        const chunks: Buffer[] = []
        document.on('data', (chunk: Buffer) => chunks.push(chunk))
        document.on('end', () => resolve(Buffer.concat(chunks)))
        document.on('error', reject)
        document.registerFont('NotoSansJP', fontPath)
        document.font('NotoSansJP').fillColor('#111827')

        document.fontSize(18).text(`${invoice.fiscalYear}年 ${quarterLabel(invoice.quarter)} 分子生物実験センター利用料`, { align: 'center' })
        document.moveDown(0.3).fontSize(13).text('個人別請求書（研究用）', { align: 'center' })
        document.moveDown(1)

        const left = 42
        const tableWidth = 511
        const rowHeight = 28
        const drawInfo = (label: string, value: string) => {
            const y = document.y
            document.rect(left, y, tableWidth, rowHeight).stroke('#94a3b8')
            document.fontSize(11).text(label, left + 10, y + 8, { width: 105 })
            document.fontSize(11).text(value, left + 125, y + 8, { width: tableWidth - 135 })
            document.y = y + rowHeight
        }
        drawInfo('学部', invoice.user.department ?? '')
        drawInfo('所属', invoice.user.laboratory ?? '')
        drawInfo('利用者', invoice.user.name)
        document.moveDown(1)

        const columns = [42, 125, 220, 365, 425, 480, 553]
        const headers = ['日付', '利用者', '利用項目', '単価', '個数', '合計']
        const top = document.y
        document.rect(left, top, tableWidth, 25).fillAndStroke('#eff6ff', '#94a3b8')
        document.fillColor('#111827').fontSize(9)
        headers.forEach((header, index) => document.text(header, columns[index] + 5, top + 8, { width: columns[index + 1] - columns[index] - 8 }))
        invoice.items.forEach((item, index) => {
            const y = top + 25 + index * 23
            const values = [new Intl.DateTimeFormat('ja-JP').format(new Date(item.date)), invoice.user.name, item.itemName, `¥${item.unitPrice.toLocaleString()}`, String(item.quantity), `¥${item.amount.toLocaleString()}`]
            values.forEach((value, valueIndex) => {
                document.rect(columns[valueIndex], y, columns[valueIndex + 1] - columns[valueIndex], 23).stroke('#94a3b8')
                document.text(value, columns[valueIndex] + 5, y + 7, { width: columns[valueIndex + 1] - columns[valueIndex] - 8 })
            })
        })
        const totalY = top + 25 + invoice.items.length * 23 + 18
        document.rect(left, totalY, tableWidth, 38).stroke('#94a3b8')
        document.fontSize(13).text('利用料金合計', left + 10, totalY + 12)
        document.fontSize(18).text(`¥${invoice.totalAmount.toLocaleString()}`, left, totalY + 9, { width: tableWidth - 12, align: 'right' })
        document.rect(left, totalY + 58, tableWidth, 125).stroke('#94a3b8')
        document.fontSize(11).text('支出予算（記載必須）', left + 12, totalY + 78)
        document.text('●予算支出部門　________________ 学部', left + 12, totalY + 106)
        document.text('●予算科目　①一般研究費　②実習費　③受託　④助成', left + 12, totalY + 134)
        document.text('●配分先コード　________________', left + 12, totalY + 162)
        document.text('振込先　分子生物実験センター　　受注 No', left + 12, totalY + 190)
        document.fontSize(12).text('分子生物実験センター長', left, 725, { width: tableWidth, align: 'right' })
        document.fontSize(14).text(invoice.sealer?.name ?? '', left, 750, { width: tableWidth, align: 'right' })
        if (invoice.sealer?.sealImage?.startsWith('data:image/')) {
            document.image(Buffer.from(invoice.sealer.sealImage.split(',')[1], 'base64'), 480, 765, { fit: [60, 60] })
        }
        document.fontSize(10).text(new Intl.DateTimeFormat('ja-JP').format(new Date()), left, 790)
        document.end()
    })
}
