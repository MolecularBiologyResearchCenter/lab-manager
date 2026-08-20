'use client'

import { useState, useEffect, useRef, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { sealInvoice } from '@/app/actions'
import { toast } from 'sonner'

interface InvoiceItem {
    id: string
    date: Date
    itemName: string
    unitPrice: number
    quantity: number
    amount: number
}

interface User {
    id: string
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
    userId: string
    user: User
    items: InvoiceItem[]
    sealedBy: string | null
    sealedAt: Date | null
    sealer?: {
        name: string
        sealImage: string | null
    }
    viewerRole?: string
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const invoiceRef = useRef<HTMLDivElement>(null)
    const [invoice, setInvoice] = useState<Invoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [downloading, setDownloading] = useState(false)
    const [sealing, setSealing] = useState(false)

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
                    router.push('/invoices')
                    return
                }
                const data = await response.json()
                setInvoice(data)
            } catch (error) {
                console.error('Failed to fetch invoice:', error)
                router.push('/invoices')
            } finally {
                setLoading(false)
            }
        }
        fetchInvoice()
    }, [id, router])

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
        if (!invoiceRef.current || !invoice) return

        setDownloading(true)

        // Temporarily disable mobile mode for PDF generation
        const wasMobile = isMobile
        if (wasMobile) {
            setIsMobile(false)
            // Wait for re-render with desktop layout
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        try {
            // Capture the invoice card as canvas
            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 1280, // Force desktop width
                windowHeight: 720
            })

            // A4 dimensions in mm
            const a4Width = 210
            const a4Height = 297

            // Create PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            const imgData = canvas.toDataURL('image/png')

            // Calculate height to maintain aspect ratio
            const imgHeight = (canvas.height * a4Width) / canvas.width

            let heightLeft = imgHeight
            let position = 0

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, a4Width, imgHeight)
            heightLeft -= a4Height

            // Add subsequent pages if content overflows
            while (heightLeft > 1) {
                position = heightLeft - imgHeight
                pdf.addPage()
                pdf.addImage(imgData, 'PNG', 0, position, a4Width, imgHeight)
                heightLeft -= a4Height
            }

            // Download PDF with formatted filename
            const filename = `請求書_${invoice.fiscalYear}年_${invoice.quarter}期_${invoice.user.name}.pdf`

            // Get Blob from jsPDF
            const pdfBlob = pdf.output('blob')

            // Send to server for signing
            const formData = new FormData()
            formData.append('file', pdfBlob, filename)

            try {
                const signResponse = await fetch('/api/sign-pdf', {
                    method: 'POST',
                    body: formData,
                })

                if (!signResponse.ok) {
                    throw new Error('Signing failed')
                }

                const signedBlob = await signResponse.blob()

                // Download signed PDF
                const url = window.URL.createObjectURL(signedBlob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)

                toast.success('電子署名付きPDFをダウンロードしました')
            } catch (signError) {
                console.error('Signing error, falling back to unsigned:', signError)
                toast.error('電子署名の付与に失敗しました（署名なしでダウンロードします）')
                pdf.save(filename)
            }
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            alert('PDFの生成に失敗しました')
        } finally {
            // Restore mobile mode if it was enabled
            if (wasMobile) {
                setIsMobile(true)
            }
            setDownloading(false)
        }
    }

    const handleSeal = async () => {
        if (!confirm('この請求書に電子印を押しますか？\n※この操作は取り消せません。')) return

        setSealing(true)
        try {
            await sealInvoice(id)
            setInvoice(prev => prev ? { ...prev, sealedAt: new Date(), sealedBy: 'current-user' } : null)
            toast.success('電子印を押しました')
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setSealing(false)
        }
    }

    if (loading) {
        return (
            <div className="content-wrapper py-8">
                <div className="text-center">読み込み中...</div>
            </div>
        )
    }

    if (!invoice) {
        return null
    }

    return (
        <div className="content-wrapper py-8">
            {/* Navigation */}
            <div className="mb-6 print:hidden flex gap-3 justify-between">
                <div className="flex gap-3">
                    <Link href="/invoices">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            請求書一覧に戻る
                        </Button>
                    </Link>
                    {/* Download Button Logic */}
                    {(() => {
                        const isSealed = !!invoice.sealedAt
                        const isAdminOrDirector = invoice.viewerRole === 'ADMIN' || invoice.viewerRole === 'CENTER_DIRECTOR'
                        const canDownload = isSealed || isAdminOrDirector

                        if (canDownload) {
                            return (
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={downloading}
                                    style={{ backgroundColor: '#2563eb', color: 'white' }}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    {downloading ? 'ダウンロード中...' : 'PDFダウンロード'}
                                </Button>
                            )
                        } else {
                            return (
                                <Button
                                    disabled={true}
                                    variant="outline"
                                    className="bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed"
                                >
                                    <span className="flex items-center">
                                        センター長承認待ち
                                    </span>
                                </Button>
                            )
                        }
                    })()}
                </div>
                {invoice.viewerRole === 'CENTER_DIRECTOR' && !invoice.sealedAt && (
                    <Button
                        onClick={handleSeal}
                        disabled={sealing}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                        {sealing ? '処理中...' : '電子印を押す'}
                    </Button>
                )}
            </div>

            {/* Print Instructions */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                    <strong>案内:</strong> ダウンロード後に印刷し、必要事項をご記入の上、学部経理に提出してください。
                </p>
            </div>

            {/* Invoice Document - Fixed A4 Width */}
            <div className="overflow-auto flex justify-center bg-white p-8">
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
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">所属長</span>
                                    <span>印<span style={{ color: 'red' }}>（必須）</span></span>
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
                                        <>
                                            {invoice.sealer?.sealImage ? (
                                                <div
                                                    className="absolute"
                                                    style={{
                                                        right: '0px',
                                                        top: '-15px',
                                                        zIndex: 5,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <img
                                                        src={invoice.sealer.sealImage}
                                                        alt="電子印"
                                                        className="w-[60px] h-[60px] object-contain opacity-80"
                                                    />
                                                    <span
                                                        style={{
                                                            position: 'absolute',
                                                            color: '#ef4444', // Red-500
                                                            fontSize: '8px',
                                                            fontWeight: 'bold',
                                                            zIndex: 10,
                                                            whiteSpace: 'nowrap',
                                                            fontFamily: 'Arial, sans-serif'
                                                        }}
                                                    >
                                                        {new Date(invoice.sealedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div
                                                    className="absolute"
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        border: '3px solid #ef4444',
                                                        borderRadius: '50%',
                                                        right: '0px',
                                                        top: '-15px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        color: '#ef4444',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        lineHeight: '1.1',
                                                        opacity: 0.8,
                                                        zIndex: 5,
                                                        position: 'absolute'
                                                    }}
                                                >
                                                    <span>北里大</span>
                                                    <span>分子セ</span>
                                                    <span>ンター</span>
                                                    <span>長之印</span>
                                                    <span
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: '#ef4444',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            backgroundColor: 'rgba(255, 255, 255, 0.8)', // To make it readable over text
                                                            padding: '0 2px'
                                                        }}
                                                    >
                                                        {new Date(invoice.sealedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
                                                    </span>
                                                </div>
                                            )}
                                        </>
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
