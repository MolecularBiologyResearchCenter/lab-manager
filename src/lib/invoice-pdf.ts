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

const fontPath = path.join(process.cwd(), 'public/fonts/noto-sans-jp-japanese-400-normal.woff')

function quarterLabel(quarter: number) {
    return quarter === 1 ? '1-4月' : quarter === 2 ? '5-8月' : quarter === 3 ? '9-12月' : `${quarter}期`
}

export function createInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument({ size: 'A4', margin: 28, compress: true, font: fontPath })
        const chunks: Buffer[] = []
        document.on('data', (chunk: Buffer) => chunks.push(chunk))
        document.on('end', () => resolve(Buffer.concat(chunks)))
        document.on('error', reject)
        document.registerFont('NotoSansJP', fontPath)
        document.font('NotoSansJP').fillColor('#111827')

        document.fontSize(16).text(`${invoice.fiscalYear}年 ${quarterLabel(invoice.quarter)} 分子生物実験センター利用料`, { align: 'center' })
        document.moveDown(0.15).fontSize(11).text('個人別請求書（研究用）', { align: 'center' })
        document.moveDown(0.55)

        const left = 28
        const tableWidth = 539
        const rowHeight = 19
        const drawInfo = (label: string, value: string) => {
            const y = document.y
            document.rect(left, y, tableWidth, rowHeight).stroke('#94a3b8')
            document.fontSize(8).text(label, left + 8, y + 6, { width: 78 })
            document.fontSize(8).text(value, left + 92, y + 6, { width: tableWidth - 100 })
            document.y = y + rowHeight
        }
        drawInfo('学部', invoice.user.department ?? '')
        drawInfo('所属', invoice.user.laboratory ?? '')
        drawInfo('利用者', invoice.user.name)
        document.moveDown(0.55)

        const columns = [28, 108, 205, 365, 425, 480, 567]
        const headers = ['日付', '利用者', '利用項目', '単価', '個数', '合計']
        const top = document.y
        document.rect(left, top, tableWidth, 18).fillAndStroke('#eff6ff', '#94a3b8')
        document.fillColor('#111827').fontSize(7)
        headers.forEach((header, index) => document.text(header, columns[index] + 4, top + 5, { width: columns[index + 1] - columns[index] - 6 }))
        invoice.items.forEach((item, index) => {
            const y = top + 18 + index * 16
            const values = [new Intl.DateTimeFormat('ja-JP').format(new Date(item.date)), invoice.user.name, item.itemName, `¥${item.unitPrice.toLocaleString()}`, String(item.quantity), `¥${item.amount.toLocaleString()}`]
            values.forEach((value, valueIndex) => {
                document.rect(columns[valueIndex], y, columns[valueIndex + 1] - columns[valueIndex], 16).stroke('#94a3b8')
                document.fontSize(7).text(value, columns[valueIndex] + 4, y + 5, { width: columns[valueIndex + 1] - columns[valueIndex] - 6 })
            })
        })
        const totalY = top + 18 + invoice.items.length * 16 + 10
        document.rect(left, totalY, tableWidth, 27).stroke('#94a3b8')
        document.fontSize(10).text('利用料金合計', left + 8, totalY + 8)
        document.fontSize(14).text(`¥${invoice.totalAmount.toLocaleString()}`, left, totalY + 6, { width: tableWidth - 10, align: 'right' })
        document.rect(left, totalY + 38, tableWidth, 105).stroke('#94a3b8')
        document.fontSize(8).text('支出予算（記載必須）', left + 10, totalY + 50)
        document.text('- 予算支出部門　________________ 学部', left + 10, totalY + 69)
        document.text('- 予算科目　(1)一般研究費　(2)実習費　(3)受託　(4)助成', left + 10, totalY + 88)
        document.text('- 配分先コード　________________', left + 10, totalY + 107)
        document.text('振込先　分子生物実験センター　　受注 No', left + 10, totalY + 143)
        document.fontSize(9).text('分子生物実験センター長', left, 700, { width: tableWidth, align: 'right' })
        document.fontSize(11).text(invoice.sealer?.name ?? '', left, 718, { width: tableWidth, align: 'right' })
        if (invoice.sealer?.sealImage?.startsWith('data:image/')) {
            document.image(Buffer.from(invoice.sealer.sealImage.split(',')[1], 'base64'), 505, 725, { fit: [50, 50] })
        }
        document.fontSize(8).text(new Intl.DateTimeFormat('ja-JP').format(new Date()), left, 760)
        document.end()
    })
}
