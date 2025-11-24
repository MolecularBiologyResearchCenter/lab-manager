import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser()
    if (!user) {
        redirect('/login')
    }

    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
            user: true,
            items: {
                orderBy: {
                    date: 'asc',
                },
            },
        },
    })

    if (!invoice) {
        redirect('/invoices')
    }

    // Check if user owns this invoice or is admin
    if (invoice.userId !== user.id && user.role !== 'ADMIN') {
        redirect('/invoices')
    }

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

    return (
        <div className="content-wrapper py-8">
            {/* Navigation */}
            <div className="mb-6 print:hidden">
                <Link href="/invoices">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        請求書一覧に戻る
                    </Button>
                </Link>
            </div>

            {/* Print Instructions */}
            <div className="mb-6 print:hidden bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>印刷方法:</strong> ブラウザのメニューから「印刷」を選択するか、Ctrl+P（Mac: Cmd+P）を押してください。
                </p>
            </div>

            {/* Invoice Document */}
            <Card className="card-elevated max-w-4xl mx-auto">
                <CardContent className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-sm font-bold mb-2 invoice-title">
                            {invoice.fiscalYear}年 {getQuarterLabel(invoice.quarter)} 分子生物実験センター利用料
                        </h1>
                        <p className="text-sm invoice-subtitle">個人別請求書（研究用）</p>
                    </div>

                    {/* User Info */}
                    <div className="grid grid-cols-2 gap-4 mb-8 border border-gray-300">
                        <div className="border-r border-gray-300 p-3">
                            <div className="flex">
                                <span className="w-20 font-medium">学部</span>
                                <span>{invoice.user.department || '一般教育学部'}</span>
                            </div>
                        </div>
                        <div className="p-3">
                            <div className="flex justify-between">
                                <span className="font-medium">所属長</span>
                                <span className="text-red-600">印（必須）</span>
                            </div>
                        </div>
                        <div className="border-r border-t border-gray-300 p-3">
                            <div className="flex">
                                <span className="w-20 font-medium">所属</span>
                                <span>{invoice.user.laboratory || '生物学'}</span>
                            </div>
                        </div>
                        <div className="border-t border-gray-300 p-3">
                            <div className="flex">
                                <span className="w-20 font-medium">利用者</span>
                                <span>{invoice.user.name}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8">
                        <table className="w-full border-collapse border border-gray-300">
                            <thead className="bg-blue-100">
                                <tr>
                                    <th className="border border-gray-300 p-2 text-left">日付</th>
                                    <th className="border border-gray-300 p-2 text-left">利用者</th>
                                    <th className="border border-gray-300 p-2 text-left">利用項目</th>
                                    <th className="border border-gray-300 p-2 text-right">単価</th>
                                    <th className="border border-gray-300 p-2 text-right">個数</th>
                                    <th className="border border-gray-300 p-2 text-right">合計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="border border-gray-300 p-2">
                                            {new Date(item.date).toLocaleDateString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                            })}
                                        </td>
                                        <td className="border border-gray-300 p-2">{invoice.user.name}</td>
                                        <td className="border border-gray-300 p-2">{item.itemName}</td>
                                        <td className="border border-gray-300 p-2 text-right">
                                            ¥{item.unitPrice.toLocaleString()}
                                        </td>
                                        <td className="border border-gray-300 p-2 text-right">{item.quantity}</td>
                                        <td className="border border-gray-300 p-2 text-right">
                                            ¥{item.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Total */}
                    <div className="mb-8">
                        <table className="w-full border-collapse border border-gray-300">
                            <tbody>
                                <tr>
                                    <td className="border border-gray-300 p-3 font-medium w-1/2">利用料合計</td>
                                    <td className="border border-gray-300 p-3 text-right text-xl font-bold">
                                        ¥{invoice.totalAmount.toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Budget Section */}
                    <div className="mb-8 border border-gray-300 p-4">
                        <div className="mb-4">
                            <p className="font-medium mb-2">
                                支出予算 <span className="text-red-600">（記載必須）</span>
                            </p>
                            <div className="mb-2">
                                <p className="mb-1">●予算支出部門</p>
                                <p className="ml-4">
                                    {invoice.budgetDepartment || '_______________'}学部
                                </p>
                            </div>
                            <div className="mb-2">
                                <p className="mb-1">●予算科目（○で囲む）</p>
                                <p className="ml-4">
                                    ① 一般研究費　②実習費　③受託　④助成　⑤その他（
                                    {invoice.budgetCategory || '　　　　　　　　　　　　　　　　　　'}
                                    ）具体的に記載
                                </p>
                            </div>
                            <div>
                                <p className="mb-1">●配分先コード（ACOffice で用いるコード）</p>
                                <p className="ml-4">{invoice.budgetCode || '_______________'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="grid grid-cols-2 gap-4 border border-gray-300">
                        <div className="border-r border-gray-300 p-3">
                            <p className="font-medium">振込先</p>
                            <p>分子生物実験センター</p>
                        </div>
                        <div className="p-3">
                            <p className="font-medium">受注 No</p>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-between items-center">
                        <p>
                            {invoice.fiscalYear}年{' '}
                            {invoice.quarter === 1 ? '5' : invoice.quarter === 2 ? '9' : '1'}月 10日
                        </p>
                        <div className="text-right">
                            <p className="mb-2">分子生物実験センター長</p>
                            <p className="mb-2">藤岡　正人　　印</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
