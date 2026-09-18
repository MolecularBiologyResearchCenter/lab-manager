import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFImage, PDFPage, rgb } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const BORDER = rgb(0.58, 0.65, 0.72)
const HEADER_BACKGROUND = rgb(0.94, 0.97, 1)
const TEXT = rgb(0.06, 0.09, 0.16)
const RED = rgb(0.86, 0.15, 0.15)

type InvoicePdfData = {
    invoiceNumber: string
    fiscalYear: number
    quarter: number
    totalAmount: number
    budgetDepartment: string | null
    budgetCategory: string | null
    budgetCode: string | null
    user: {
        name: string
        department: string | null
        laboratory: string | null
    }
    items: Array<{
        date: Date
        itemName: string
        unitPrice: number
        quantity: number
        amount: number
    }>
    sealedAt: Date
    sealer: {
        name: string
        sealImage: string | null
    }
}

function quarterLabel(quarter: number) {
    if (quarter === 1) return '1〜4月'
    if (quarter === 2) return '5〜8月'
    if (quarter === 3) return '9〜12月'
    return `${quarter}期`
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).format(date)
}

function formatSealDate(date: Date) {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date).replace(/\//g, '.')
}

function yen(value: number) {
    return `¥${Math.round(value).toLocaleString('ja-JP')}`
}

type Font = ReturnType<typeof fontkit.create>

function textWidth(font: Font, text: string, size: number) {
    return font.layout(text).advanceWidth * size / font.unitsPerEm
}

function pathForPdf(commands: Array<{ command: string; args: number[] }>) {
    return commands.map(({ command, args }) => {
        switch (command) {
            case 'moveTo': return `M${args[0]} ${-args[1]}`
            case 'lineTo': return `L${args[0]} ${-args[1]}`
            case 'quadraticCurveTo': return `Q${args[0]} ${-args[1]} ${args[2]} ${-args[3]}`
            case 'bezierCurveTo': return `C${args[0]} ${-args[1]} ${args[2]} ${-args[3]} ${args[4]} ${-args[5]}`
            case 'closePath': return 'Z'
            default: return ''
        }
    }).join(' ')
}

function drawText(page: PDFPage, font: Font, text: string, x: number, y: number, size: number, options: { color?: ReturnType<typeof rgb>; maxWidth?: number; align?: 'left' | 'right' | 'center' } = {}) {
    const color = options.color ?? TEXT
    const width = textWidth(font, text, size)
    const maxWidth = options.maxWidth ?? width
    const alignedX = options.align === 'right'
        ? x + maxWidth - width
        : options.align === 'center'
            ? x + (maxWidth - width) / 2
            : x
    const scale = size / font.unitsPerEm
    let cursor = alignedX
    const layout = font.layout(text)
    for (let index = 0; index < layout.glyphs.length; index += 1) {
        const glyph = layout.glyphs[index]
        const position = layout.positions[index]
        const glyphPath = pathForPdf((glyph.path as unknown as { commands: Array<{ command: string; args: number[] }> }).commands)
        if (glyphPath) {
            page.drawSvgPath(glyphPath, {
                x: cursor + position.xOffset * scale,
                y: y + position.yOffset * scale,
                scale,
                color,
            })
        }
        cursor += position.xAdvance * scale
    }
}

function drawCell(page: PDFPage, font: Font, text: string, x: number, y: number, width: number, height: number, options: { bold?: boolean; align?: 'left' | 'right' | 'center'; color?: ReturnType<typeof rgb>; fillColor?: ReturnType<typeof rgb>; size?: number } = {}) {
    page.drawRectangle({ x, y, width, height, borderColor: BORDER, borderWidth: 0.7, color: options.fillColor })
    const size = options.size ?? 9
    const padding = 6
    drawText(page, font, text, x + padding, y + (height - size) / 2 + 2, size, {
        color: options.color,
        maxWidth: width - padding * 2,
        align: options.align,
    })
}

async function readSealImage(sealImage: string | null) {
    const fallback = path.join(process.cwd(), 'public', 'seals', 'center-director-fujioka.png')
    if (!sealImage) return fs.readFile(fallback)
    if (sealImage.startsWith('data:image/')) {
        const [, encoded] = sealImage.split(',', 2)
        if (encoded) return Buffer.from(encoded, 'base64')
    }
    const relativePath = sealImage.startsWith('/') ? sealImage.slice(1) : sealImage
    try {
        return await fs.readFile(path.join(process.cwd(), 'public', relativePath))
    } catch {
        return fs.readFile(fallback)
    }
}

async function embedSeal(pdf: PDFDocument, sealImage: string | null): Promise<PDFImage> {
    const bytes = await readSealImage(sealImage)
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return pdf.embedJpg(bytes)
    return pdf.embedPng(bytes)
}

export async function generateInvoicePdf(invoice: InvoicePdfData) {
    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    const fontBytes = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'noto-sans-jp-japanese-400-normal.woff'))
    const font = fontkit.create(fontBytes)
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const contentWidth = PAGE_WIDTH - MARGIN * 2
    let y = PAGE_HEIGHT - MARGIN

    drawText(page, font, `${invoice.fiscalYear}年 ${quarterLabel(invoice.quarter)} 分子生物実験センター利用料`, MARGIN, y - 20, 17, { maxWidth: contentWidth, align: 'center' })
    drawText(page, font, '個人別請求書（研究用）', MARGIN, y - 46, 13, { maxWidth: contentWidth, align: 'center' })
    y -= 70

    const infoHeight = 34
    const half = contentWidth / 2
    const infoRows = [
        [['学部', invoice.user.department || '一般教育学部'], ['所属長', '印（必須）']],
        [['所属', invoice.user.laboratory || '生物学'], ['利用者', invoice.user.name]],
    ]
    for (const row of infoRows) {
        for (let index = 0; index < row.length; index += 1) {
            const [label, value] = row[index]
            page.drawRectangle({ x: MARGIN + half * index, y: y - infoHeight, width: half, height: infoHeight, borderColor: BORDER, borderWidth: 0.7 })
            drawText(page, font, label, MARGIN + half * index + 8, y - 21, 10, { maxWidth: 70 })
            if (label === '所属長') {
                const rightEdge = MARGIN + half * (index + 1) - 8
                const requiredWidth = textWidth(font, '（必須）', 10)
                const sealLabelWidth = textWidth(font, '印', 10)
                drawText(page, font, '印', rightEdge - requiredWidth - sealLabelWidth, y - 21, 10)
                drawText(page, font, '（必須）', rightEdge - requiredWidth, y - 21, 10, { color: RED })
            } else {
                drawText(page, font, value, MARGIN + half * index + 86, y - 21, 10, { maxWidth: half - 94 })
            }
        }
        y -= infoHeight
    }
    y -= 24

    const columns = [
        { label: '日付', width: contentWidth * 0.15, align: 'left' as const },
        { label: '利用者', width: contentWidth * 0.15, align: 'left' as const },
        { label: '利用項目', width: contentWidth * 0.30, align: 'left' as const },
        { label: '単価', width: contentWidth * 0.15, align: 'right' as const },
        { label: '個数', width: contentWidth * 0.10, align: 'right' as const },
        { label: '合計', width: contentWidth * 0.15, align: 'right' as const },
    ]
    const rowHeight = 19
    let x = MARGIN
    for (const column of columns) {
        drawCell(page, font, column.label, x, y - rowHeight, column.width, rowHeight, { align: column.align, fillColor: HEADER_BACKGROUND, size: 8.5 })
        x += column.width
    }
    y -= rowHeight
    for (const item of invoice.items) {
        x = MARGIN
        const values = [formatDate(new Date(item.date)), invoice.user.name, item.itemName, yen(item.unitPrice), String(item.quantity), yen(item.amount)]
        for (let index = 0; index < columns.length; index += 1) {
            drawCell(page, font, values[index], x, y - rowHeight, columns[index].width, rowHeight, { align: columns[index].align, size: 7.5 })
            x += columns[index].width
        }
        y -= rowHeight
    }
    y -= 22

    const totalHeight = 40
    drawCell(page, font, '利用料合計', MARGIN, y - totalHeight, contentWidth / 2, totalHeight, { size: 13 })
    drawCell(page, font, yen(invoice.totalAmount), MARGIN + contentWidth / 2, y - totalHeight, contentWidth / 2, totalHeight, { align: 'right', size: 17 })
    y -= totalHeight + 25

    const budgetHeight = 102
    page.drawRectangle({ x: MARGIN, y: y - budgetHeight, width: contentWidth, height: budgetHeight, borderColor: BORDER, borderWidth: 0.7 })
    drawText(page, font, '支出予算', MARGIN + 9, y - 18, 10)
    drawText(page, font, '（記載必須）', MARGIN + 65, y - 18, 10, { color: RED })
    drawText(page, font, '・予算支出部門', MARGIN + 9, y - 35, 8.5)
    drawText(page, font, `${invoice.budgetDepartment || '_______________'}学部`, MARGIN + 25, y - 50, 8.5)
    drawText(page, font, '・予算科目（〇で囲む）', MARGIN + 9, y - 66, 8.5)
    drawText(page, font, '1. 一般研究費　2. 実習費　3. 受託　4. 助成', MARGIN + 25, y - 81, 8.5)
    drawText(page, font, `5. その他（${invoice.budgetCategory || '　　　　　　　　　'}）具体的に記載`, MARGIN + 25, y - 96, 8.5)
    y -= budgetHeight + 20

    const footerHeight = 22
    drawCell(page, font, '振込先　分子生物実験センター', MARGIN, y - footerHeight, contentWidth / 2, footerHeight, { size: 8.5 })
    drawCell(page, font, '受注 No', MARGIN + contentWidth / 2, y - footerHeight, contentWidth / 2, footerHeight, { size: 8.5 })

    const seal = await embedSeal(pdf, invoice.sealer.sealImage)
    drawText(page, font, formatDate(new Date()), MARGIN, 72, 9)
    drawText(page, font, '分子生物実験センター長', PAGE_WIDTH - MARGIN - 170, 111, 9, { maxWidth: 170, align: 'right' })
    drawText(page, font, `${invoice.sealer.name}　印`, PAGE_WIDTH - MARGIN - 170, 87, 12, { maxWidth: 170, align: 'right' })
    page.drawImage(seal, { x: PAGE_WIDTH - MARGIN - 64, y: 76, width: 58, height: 58, opacity: 0.82 })
    drawText(page, font, formatSealDate(new Date(invoice.sealedAt)), PAGE_WIDTH - MARGIN - 60, 102, 6.5, { maxWidth: 50, align: 'center', color: RED })

    return Buffer.from(await pdf.save({ useObjectStreams: true }))
}
