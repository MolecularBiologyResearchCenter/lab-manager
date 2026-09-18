'use client'

import { useState, useEffect, useRef, use } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { sealInvoice } from '@/app/actions'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiClientError, formatApiError, readApiError } from '@/lib/api-client'

interface InvoiceItem {
    id: string
    date: Date
    itemName: string
    unitPrice: number
    quantity: number
    amount: number
}

interface User {
    name: string
    department: string | null
    laboratory: string | null
}

interface Invoice {
    id: string
    fiscalYear: number
    quarter: number
    totalAmount: number
    budgetDepartment: string | null
    budgetCategory: string | null
    budgetCode: string | null
    user: User
    items: InvoiceItem[]
    sealedBy: string | null
    sealedAt: Date | string | null
    sealer?: {
        name: string
        sealImage: string | null
    }
    viewerRole?: string
}

const DEFAULT_SEAL_IMAGE = '/seals/center-director-fujioka.png'

function formatSealDate(date: Date | string) {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(date)).replace(/\//g, '.')
}

function getSubmissionDeadline(fiscalYear: number, quarter: number) {
    const deadline = new Date(fiscalYear, quarter * 4, 1)
    return `${deadline.getFullYear()}年${deadline.getMonth() + 1}月末`
}

function sanitizeFilenamePart(value: string) {
    return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '利用者'
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const searchParams = useSearchParams()
    const backHref = searchParams.get('from') === 'admin' ? '/admin/invoices' : '/invoices'
    const invoiceRef = useRef<HTMLDivElement>(null)
    const pdfRootRef = useRef<HTMLDivElement>(null)
    const [invoice, setInvoice] = useState<Invoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [downloading, setDownloading] = useState(false)
    const [sealing, setSealing] = useState(false)
    const [sealDialogOpen, setSealDialogOpen] = useState(false)
    const [sealConfirmed, setSealConfirmed] = useState(false)

    // Mobile detection
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        async function fetchInvoice() {
            try {
                const response = await fetch(`/api/invoices/${id}`)
                if (!response.ok) {
                    const apiError = await readApiError(response, '請求書を取得できませんでした。')
                    toast.error(formatApiError(apiError))
                    router.push(backHref)
                    return
                }
                const data = await response.json()
                setInvoice(data)
            } catch (error) {
                console.error('Failed to fetch invoice:', error)
                const apiError = new ApiClientError({
                    error: '請求書を取得できませんでした。',
                    guidance: 'ネットワーク接続を確認して、もう一度お試しください。',
                    requestId: '問い合わせ番号を取得できませんでした',
                })
                toast.error(formatApiError(apiError))
                router.push(backHref)
            } finally {
                setLoading(false)
            }
        }
        fetchInvoice()
    }, [backHref, id, router])

    const getQuarterLabel = (quarter: number) => {
        switch (quarter) {
            case 1:
                return '1～4月'
            case 2:
                return '5～8月'
            case 3:
                return '9～12月'
            default:
                return `${quarter}期`
        }
    }

    const handleDownloadPDF = async () => {
        if (!invoice) return
        if (!invoice.sealedAt || !invoice.sealedBy) {
            toast.info('案内：センター長の押印をお待ちください')
            return
        }
        if (!pdfRootRef.current) return

        setDownloading(true)

        try {
            const pdfRoot = pdfRootRef.current
            const waitForNextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

            const createPdf = async (scale: number, jpegQuality: number) => {
                await waitForNextFrame()
                await waitForNextFrame()
                if (document.fonts?.ready) await document.fonts.ready
                await Promise.all(Array.from(pdfRoot.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)))

                const canvas = await html2canvas(pdfRoot, {
                    scale,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    allowTaint: false,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 794,
                    windowHeight: 1123,
                    foreignObjectRendering: false,
                    width: 794,
                    height: 1123,
                })
                const context = canvas.width > 0 && canvas.height > 0
                    ? canvas.getContext('2d', { willReadFrequently: true })
                    : null
                const pixels = context ? context.getImageData(0, 0, canvas.width, canvas.height).data : undefined
                let nonWhitePixels = 0
                if (pixels) {
                    for (let index = 0; index < pixels.length; index += 4) {
                        const alpha = pixels[index + 3]
                        const isWhite = pixels[index] > 248 && pixels[index + 1] > 248 && pixels[index + 2] > 248
                        if (alpha > 0 && !isWhite) nonWhitePixels++
                    }
                }
                const rootRect = pdfRoot.getBoundingClientRect()
                if (canvas.width === 0 || canvas.height === 0 || nonWhitePixels < 100) {
                    console.error('請求書PDFの描画結果が白紙です。', {
                        invoiceId: invoice.id,
                        canvasWidth: canvas.width,
                        canvasHeight: canvas.height,
                        elementWidth: rootRect.width,
                        elementHeight: rootRect.height,
                        nonWhitePixels,
                        scale,
                    })
                    throw new Error('請求書の描画に失敗しました')
                }

                const imgData = canvas.toDataURL('image/jpeg', jpegQuality)
                if (!imgData || imgData === 'data:,') throw new Error('請求書PDFの画像データを作成できませんでした')

                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
                const a4Width = 210
                const a4Height = 297
                const imgHeight = (canvas.height * a4Width) / canvas.width
                let heightLeft = imgHeight
                let position = 0
                pdf.addImage(imgData, 'JPEG', 0, position, a4Width, imgHeight)
                heightLeft -= a4Height
                while (heightLeft > 1) {
                    position = heightLeft - imgHeight
                    pdf.addPage()
                    pdf.addImage(imgData, 'JPEG', 0, position, a4Width, imgHeight)
                    heightLeft -= a4Height
                }
                return pdf
            }

            let pdf = await createPdf(2, 0.88)
            let pdfBlob = pdf.output('blob')
            if (pdfBlob.size > 9.5 * 1024 * 1024) {
                pdf = await createPdf(1.5, 0.80)
                pdfBlob = pdf.output('blob')
            }

            const safeUserName = sanitizeFilenamePart(invoice.user.name)
            const filename = `請求書_${invoice.fiscalYear}年_${invoice.quarter}期_${safeUserName}.pdf`

            if (pdfBlob.size < 1000) {
                console.error('請求書PDFのファイルサイズが小さすぎます。', { invoiceId: invoice.id, fileSize: pdfBlob.size })
                toast.error('請求書の描画に失敗しました。画面を再読み込みして、もう一度お試しください。')
                return
            }
            if (pdfBlob.size > 10 * 1024 * 1024) {
                toast.error('PDFの容量が10MBを超えています。明細や画像を減らしてください。')
                return
            }

            const formData = new FormData()
            formData.append('file', pdfBlob, filename)
            let downloadResponse: Response
            try {
                downloadResponse = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: 'POST', body: formData, cache: 'no-store' })
            } catch (error) {
                console.error('押印済みPDF確認APIへの接続に失敗しました。', error)
                toast.error('エラー：押印済みPDFを取得できませんでした。\n次の操作：ネットワーク接続を確認して、もう一度お試しください。\n問い合わせ番号：問い合わせ番号を取得できませんでした')
                return
            }
            if (!downloadResponse.ok) {
                const apiError = await readApiError(downloadResponse, '押印済みPDFを取得できませんでした。')
                toast.error(`${formatApiError(apiError)}\nPDFはダウンロードされませんでした。`)
                return
            }

            const approvedBlob = await downloadResponse.blob()
            const url = window.URL.createObjectURL(approvedBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.success('押印済みPDFをダウンロードしました')
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            if (error instanceof Error && error.message === '請求書の描画に失敗しました') {
                toast.error('請求書の描画に失敗しました。画面を再読み込みして、もう一度お試しください。')
            } else {
                toast.error('エラー：PDFの生成に失敗しました。\n次の操作：画面を更新して、もう一度お試しください。\n問い合わせ番号：問い合わせ番号を取得できませんでした')
            }
        } finally {
            setDownloading(false)
        }
    }

    const handleSeal = () => {
        setSealConfirmed(false)
        setSealDialogOpen(true)
    }

    const confirmSeal = async () => {
        if (!sealConfirmed) return
        setSealing(true)
        try {
            await sealInvoice(id)
            setInvoice(prev => prev ? { ...prev, sealedAt: new Date(), sealedBy: 'current-user' } : null)
            toast.success('電子印を押しました')
            setSealDialogOpen(false)
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setSealing(false)
        }
    }

    if (loading) {
        return (
            <div className="content-wrapper app-page">
                <div className="text-center text-sm text-slate-500">読み込み中...</div>
            </div>
        )
    }

    if (!invoice) {
        return null
    }

    return (
        <div className="content-wrapper app-page">
            {/* Navigation */}
            <div className="mb-5 flex flex-col justify-between gap-3 print:hidden sm:flex-row">
                <div className="flex flex-wrap gap-2">
                    <Link href={backHref}>
                        <Button variant="outline" className="rounded-xl border-slate-300 bg-white">
                            <ArrowLeft className="h-4 w-4" />
                            請求書一覧に戻る
                        </Button>
                    </Link>
                    {/* Download Button Logic */}
                    {(() => {
                        const isSealed = Boolean(invoice.sealedAt && invoice.sealedBy)
                        const canDownload = isSealed

                        return (
                            <div>
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={!canDownload || downloading}
                                    className={canDownload
                                        ? 'rounded-xl bg-blue-700 text-white hover:bg-blue-800'
                                        : 'cursor-not-allowed rounded-xl bg-slate-200 text-slate-500'}
                                >
                                    <Download className="h-4 w-4" />
                                    {downloading ? 'ダウンロード中...' : 'PDFダウンロード'}
                                </Button>
                                {!canDownload && (
                                    <p className="mt-2 text-sm text-slate-600">
                                        案内：センター長の押印をお待ちください
                                    </p>
                                )}
                            </div>
                        )
                    })()}
                </div>
                {invoice.viewerRole === 'CENTER_DIRECTOR' && (!invoice.sealedAt || !invoice.sealedBy) && (
                    <Button
                        onClick={handleSeal}
                        disabled={sealing}
                        className="rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700"
                    >
                        {sealing ? '処理中...' : '電子印を押す'}
                    </Button>
                )}
            </div>

            {/* Print Instructions */}
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 print:hidden">
                <p className="text-sm text-blue-800">
                    <strong>案内:</strong> ダウンロード後に印刷し、必要事項をご記入の上、{getSubmissionDeadline(invoice.fiscalYear, invoice.quarter)}までに共通事務室経理課に提出してください
                </p>
            </div>

            <Dialog open={sealDialogOpen} onOpenChange={(open) => {
                setSealDialogOpen(open)
                if (!open) setSealConfirmed(false)
            }}>
                <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white">
                    <DialogHeader>
                        <DialogTitle>電子印押印の確認</DialogTitle>
                        <DialogDescription>内容を確認してから押印してください。押印後は取り消せません。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                        <p><span className="font-medium">利用者：</span>{invoice.user.name}</p>
                        <p><span className="font-medium">対象期間：</span>{invoice.fiscalYear}年 {getQuarterLabel(invoice.quarter)}</p>
                        <p><span className="font-medium">請求額：</span>¥{invoice.totalAmount.toLocaleString()}</p>
                    </div>
                    <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <input
                            type="checkbox"
                            checked={sealConfirmed}
                            onChange={(event) => setSealConfirmed(event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <span>押印後は取り消せないことを確認しました</span>
                    </label>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSealDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={confirmSeal} disabled={!sealConfirmed || sealing} className="bg-red-600 font-semibold text-white hover:bg-red-700">
                            {sealing ? '処理中...' : '電子印を押す'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PDF専用の固定レイアウト。表示中のレスポンシブカードとは分離する。 */}
            <div
                ref={pdfRootRef}
                data-pdf-root="invoice"
                aria-hidden="true"
                style={{
                    position: 'fixed',
                    left: '-10000px',
                    top: 0,
                    width: '794px',
                    height: '1123px',
                    overflow: 'visible',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    boxSizing: 'border-box',
                    padding: '38px 56px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontFamily: '"Hiragino Sans", "Meiryo", sans-serif',
                    fontSize: '12px',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '26px' }}>
                    <h1 style={{ margin: 0, fontSize: '20px', lineHeight: 1.3, fontWeight: 700 }}>
                        {invoice.fiscalYear}年 {getQuarterLabel(invoice.quarter)} 分子生物実験センター利用料
                    </h1>
                    <p style={{ margin: '8px 0 0', fontSize: '16px' }}>個人別請求書（研究用）</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #94a3b8', marginBottom: '26px' }}>
                    {[
                        ['学部', invoice.user.department || '一般教育学部'],
                        ['所属長', '印（必須）'],
                        ['所属', invoice.user.laboratory || '生物学'],
                        ['利用者', invoice.user.name],
                    ].map(([label, value], index) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '8px', minHeight: '34px', borderTop: index > 1 ? '1px solid #94a3b8' : undefined, borderLeft: index % 2 === 1 ? '1px solid #94a3b8' : undefined }}>
                            <span style={{ display: 'inline-block', width: '80px', fontWeight: 600 }}>{label}</span>
                            <span style={{ color: label === '所属長' ? '#0f172a' : undefined, marginLeft: label === '所属長' ? 'auto' : undefined, textAlign: label === '所属長' ? 'right' : undefined, whiteSpace: label === '所属長' ? 'nowrap' : undefined }}>
                                {label === '所属長' ? (
                                    <>
                                        印<span style={{ color: '#dc2626' }}>（必須）</span>
                                    </>
                                ) : value}
                            </span>
                        </div>
                    ))}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '10px', marginBottom: '26px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#eff6ff' }}>
                            {[
                                ['日付', '15%', 'left'],
                                ['利用者', '15%', 'left'],
                                ['利用項目', '30%', 'left'],
                                ['単価', '15%', 'right'],
                                ['個数', '10%', 'right'],
                                ['合計', '15%', 'right'],
                            ].map(([label, width, align]) => (
                                <th key={label} style={{ width, border: '1px solid #94a3b8', padding: '4px 6px', textAlign: align as 'left' | 'right', fontWeight: 600 }}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map(item => (
                            <tr key={item.id}>
                                <td style={{ border: '1px solid #94a3b8', padding: '4px 6px' }}>{new Date(item.date).toLocaleDateString('ja-JP')}</td>
                                <td style={{ border: '1px solid #94a3b8', padding: '4px 6px' }}>{invoice.user.name}</td>
                                <td style={{ border: '1px solid #94a3b8', padding: '4px 6px' }}>{item.itemName}</td>
                                <td style={{ border: '1px solid #94a3b8', padding: '4px 6px', textAlign: 'right' }}>¥{item.unitPrice.toLocaleString()}</td>
                                <td style={{ border: '1px solid #94a3b8', padding: '4px 6px', textAlign: 'right' }}>{item.quantity}</td>
                                <td style={{ border: '1px solid #94a3b8', padding: '4px 6px', textAlign: 'right' }}>¥{item.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: '26px', fontSize: '16px' }}>
                    <tbody><tr>
                        <td style={{ width: '50%', border: '1px solid #cbd5e1', padding: '10px', fontWeight: 600 }}>利用料合計</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'right', fontSize: '21px', fontWeight: 700 }}>¥{invoice.totalAmount.toLocaleString()}</td>
                    </tr></tbody>
                </table>

                <div style={{ border: '1px solid #94a3b8', padding: '12px', marginBottom: '26px', fontSize: '10px', lineHeight: 1.55 }}>
                    <p style={{ margin: '0 0 5px', fontWeight: 600 }}>支出予算 <span style={{ color: '#ef4444' }}>（記載必須）</span></p>
                    <p style={{ margin: '0 0 3px' }}>●予算支出部門</p>
                    <p style={{ margin: '0 0 3px', paddingLeft: '16px' }}>{invoice.budgetDepartment || '_______________'}学部</p>
                    <p style={{ margin: '0 0 3px' }}>●予算科目（○で囲む）</p>
                    <p style={{ margin: '0 0 3px', paddingLeft: '16px' }}>① 一般研究費　②実習費　③受託　④助成</p>
                    <p style={{ margin: '0 0 3px', paddingLeft: '16px' }}>⑤その他（{invoice.budgetCategory || '　　　　　　　　　'}）具体的に記載</p>
                    <p style={{ margin: 0 }}>●配分先コード（ACOffice で用いるコード）</p>
                    <p style={{ margin: 0, paddingLeft: '16px' }}>{invoice.budgetCode || '_______________'}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #94a3b8', fontSize: '11px' }}>
                    <div style={{ borderRight: '1px solid #94a3b8', padding: '5px 8px' }}>振込先　分子生物実験センター</div>
                    <div style={{ padding: '5px 8px' }}>受注 No</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '38px', fontSize: '12px' }}>
                    <p style={{ margin: 0 }}>{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 12px' }}>分子生物実験センター長</p>
                        <div style={{ position: 'relative', minWidth: '170px', minHeight: '64px' }}>
                            <p style={{ position: 'relative', zIndex: 2, margin: 0, fontSize: '16px' }}>{invoice.sealer?.name || '藤岡　正人'}　印</p>
                            {invoice.sealedAt && <div style={{ position: 'absolute', right: 0, top: '-20px', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={invoice.sealer?.sealImage || DEFAULT_SEAL_IMAGE} alt="電子印" style={{ width: '64px', height: '64px', objectFit: 'contain', opacity: 0.8 }} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_SEAL_IMAGE }} />
                                <span style={{ position: 'absolute', color: '#ef4444', fontSize: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif' }}>{formatSealDate(invoice.sealedAt)}</span>
                            </div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice Document - Fixed A4 Width */}
            <div className="app-surface flex justify-center overflow-auto p-3 md:p-8 print:border-0 print:p-0 print:shadow-none">
                <Card
                    className="mx-auto bg-white shadow-none"
                    ref={invoiceRef}
                    style={{
                        width: isMobile ? '100%' : '210mm',
                        minHeight: isMobile ? 'auto' : '297mm',
                        padding: isMobile ? '16px' : '10mm 15mm 15mm 15mm', // Reduced top margin
                        boxSizing: 'border-box'
                    }}
                >
                    <div style={{ fontSize: isMobile ? '14px' : '12pt', fontFamily: '"Hiragino Sans", "Meiryo", sans-serif' }}>
                        {/* Title */}
                        <div className="text-center mb-4">
                            <h1 className="font-bold mb-2" style={{ fontSize: isMobile ? '18px' : '20px' }}>
                                {invoice.fiscalYear}年 {getQuarterLabel(invoice.quarter)} 分子生物実験センター利用料
                            </h1>
                            <p style={{ fontSize: isMobile ? '16px' : '18px' }}>個人別請求書（研究用）</p>
                        </div>

                        {/* User Info */}
                        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-0 mb-8 border border-gray-400`} style={{ fontSize: isMobile ? '14px' : '12pt' }}>
                            <div className={`${isMobile ? 'border-b' : 'border-r'} border-gray-400`} style={{ padding: '8px' }}>
                                <div className="flex items-center">
                                    <span className="font-medium" style={{ width: '80px' }}>学部</span>
                                    <span style={{ marginLeft: '2em' }}>{invoice.user.department || '一般教育学部'}</span>
                                </div>
                            </div>
                            <div className={`${isMobile ? 'border-b border-gray-400' : ''}`} style={{ padding: '8px' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                    }}
                                >
                                    <span className="font-medium">所属長</span>
                                    <span
                                        style={{
                                            marginLeft: 'auto',
                                            textAlign: 'right',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        印<span style={{ color: 'red' }}>（必須）</span>
                                    </span>
                                </div>
                            </div>
                            <div className={`${isMobile ? 'border-b' : 'border-r'} border-t border-gray-400`} style={{ padding: '8px' }}>
                                <div className="flex items-center">
                                    <span className="font-medium" style={{ width: '80px' }}>所属</span>
                                    <span style={{ marginLeft: '2em' }}>{invoice.user.laboratory || '生物学'}</span>
                                </div>
                            </div>
                            <div className="border-t border-gray-400" style={{ padding: '8px' }}>
                                <div className="flex items-center">
                                    <span className="font-medium" style={{ width: '80px' }}>利用者</span>
                                    <span style={{ marginLeft: '2em' }}>{invoice.user.name}</span>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className={`mb-8 ${isMobile ? 'overflow-x-auto' : ''}`}>
                            <table className="w-full border-collapse border border-gray-400" style={{ fontSize: isMobile ? '12px' : '10pt', minWidth: isMobile ? '600px' : '100%' }}>
                                <thead className="bg-blue-50">
                                    <tr>
                                        <th className="border border-gray-400 text-left font-medium" style={{ padding: '2px 8px', width: '15%' }}>日付</th>
                                        <th className="border border-gray-400 text-left font-medium" style={{ padding: '2px 8px', width: '15%' }}>利用者</th>
                                        <th className="border border-gray-400 text-left font-medium" style={{ padding: '2px 8px', width: '30%' }}>利用項目</th>
                                        <th className="border border-gray-400 text-right font-medium" style={{ padding: '2px 8px', width: '15%' }}>単価</th>
                                        <th className="border border-gray-400 text-right font-medium" style={{ padding: '2px 8px', width: '10%' }}>個数</th>
                                        <th className="border border-gray-400 text-right font-medium" style={{ padding: '2px 8px', width: '15%' }}>合計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="border border-gray-400" style={{ padding: '2px 8px' }}>
                                                {new Date(item.date).toLocaleDateString('ja-JP', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                })}
                                            </td>
                                            <td className="border border-gray-400" style={{ padding: '2px 8px' }}>{invoice.user.name}</td>
                                            <td className="border border-gray-400" style={{ padding: '2px 8px' }}>{item.itemName}</td>
                                            <td className="border border-gray-400 text-right" style={{ padding: '2px 8px' }}>
                                                ¥{item.unitPrice.toLocaleString()}
                                            </td>
                                            <td className="border border-gray-400 text-right" style={{ padding: '2px 8px' }}>{item.quantity}</td>
                                            <td className="border border-gray-400 text-right" style={{ padding: '2px 8px' }}>
                                                ¥{item.amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Total */}
                        <div className="mb-8">
                            <table className="w-full border-collapse border border-gray-300" style={{ fontSize: '18px' }}>
                                <tbody>
                                    <tr>
                                        <td className="border border-gray-300 font-medium w-1/2" style={{ padding: '10px' }}>利用料合計</td>
                                        <td className="border border-gray-300 text-right font-bold" style={{ padding: '10px', fontSize: '22px' }}>
                                            ¥{invoice.totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Budget Section */}
                        <div className="mb-8 border border-gray-400 p-3" style={{ fontSize: isMobile ? '12px' : '10pt' }}>
                            <div className="mb-2">
                                <p className="font-medium mb-1">
                                    支出予算 <span style={{ color: 'red' }}>（記載必須）</span>
                                </p>
                                <div className="mb-1">
                                    <p className="mb-0">●予算支出部門</p>
                                    <p className="ml-4">
                                        {invoice.budgetDepartment || '_______________'}学部
                                    </p>
                                </div>
                                <div className="mb-1">
                                    <p className="mb-0">●予算科目（○で囲む）</p>
                                    <p className="ml-4">
                                        ① 一般研究費　②実習費　③受託　④助成
                                    </p>
                                    <p className="ml-4">
                                        ⑤その他（{invoice.budgetCategory || '　　　　　　　　　　　　　　　　　　'}）具体的に記載
                                    </p>
                                </div>
                                <div>
                                    <p className="mb-0">●配分先コード（ACOffice で用いるコード）</p>
                                    <p className="ml-4">{invoice.budgetCode || '_______________'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4 border border-gray-400`} style={{ fontSize: isMobile ? '12px' : '11pt' }}>
                            <div className={`${isMobile ? 'border-b' : 'border-r'} border-gray-400`} style={{ padding: '2px 8px' }}>
                                <div className="flex items-center">
                                    <p className="font-medium mr-4">振込先　</p>
                                    <p>分子生物実験センター</p>
                                </div>
                            </div>
                            <div style={{ padding: '2px 8px' }}>
                                <p className="font-medium">受注 No</p>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-between items-end" style={{ fontSize: '12pt' }}>
                            <p>
                                {new Date().toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </p>
                            <div className="text-right">
                                <p className="mb-4">分子生物実験センター長</p>
                                <div className="flex items-center justify-end relative">
                                    <p className="mb-2 text-xl" style={{ position: 'relative', zIndex: 10 }}>藤岡　正人　　印</p>
                                    {invoice.sealedAt && (
                                        <div
                                            className="absolute"
                                            style={{
                                                right: '0px',
                                                top: '-15px',
                                                zIndex: 5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <img
                                                src={invoice.sealer?.sealImage || DEFAULT_SEAL_IMAGE}
                                                alt="電子印"
                                                className="h-[60px] w-[60px] object-contain opacity-80"
                                                onError={(event) => {
                                                    event.currentTarget.onerror = null
                                                    event.currentTarget.src = DEFAULT_SEAL_IMAGE
                                                }}
                                            />
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    color: '#ef4444',
                                                    fontSize: '8px',
                                                    fontWeight: 'bold',
                                                    zIndex: 10,
                                                    whiteSpace: 'nowrap',
                                                    fontFamily: 'Arial, sans-serif',
                                                }}
                                            >
                                                {formatSealDate(invoice.sealedAt)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}
