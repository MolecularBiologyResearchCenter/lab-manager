import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { generateCurrentQuarterInvoices } from './actions'

export default async function AdminInvoicesPage() {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        redirect('/')
    }

    // Get all invoices
    const invoices = await prisma.invoice.findMany({
        include: {
            user: true,
        },
        orderBy: [
            { fiscalYear: 'desc' },
            { quarter: 'desc' },
            { user: { name: 'asc' } },
        ],
    })

    const getQuarterLabel = (quarter: number) => {
        switch (quarter) {
            case 1:
                return '第1期（1-4月）'
            case 2:
                return '第2期（5-8月）'
            case 3:
                return '第3期（9-12月）'
            default:
                return `第${quarter}期`
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft':
                return '下書き'
            case 'issued':
                return '発行済み'
            case 'paid':
                return '支払済み'
            default:
                return status
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
                return 'text-gray-600 bg-gray-100'
            case 'issued':
                return 'text-blue-600 bg-blue-100'
            case 'paid':
                return 'text-green-600 bg-green-100'
            default:
                return 'text-gray-600 bg-gray-100'
        }
    }

    return (
        <div className="content-wrapper py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">請求書管理（管理者）</h1>
                    <p className="text-gray-600">全ユーザーの請求書を管理できます</p>
                </div>
                <form action={generateCurrentQuarterInvoices}>
                    <Button type="submit" className="btn-primary">
                        <Plus className="mr-2 h-4 w-4" />
                        今期の請求書を一括生成
                    </Button>
                </form>
            </div>

            {invoices.length === 0 ? (
                <Card className="card-elevated">
                    <CardContent className="py-12">
                        <div className="text-center text-gray-500">
                            <FileText className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                            <p>請求書はまだありません</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {invoices.map((invoice) => (
                        <Card key={invoice.id} className="card-elevated hover:shadow-xl transition-shadow">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-blue-700 mb-2">
                                            {invoice.user.name} - {invoice.fiscalYear}年{' '}
                                            {getQuarterLabel(invoice.quarter)}
                                        </CardTitle>
                                        <p className="text-sm text-gray-600">
                                            請求書番号: {invoice.invoiceNumber}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {invoice.user.department} - {invoice.user.laboratory}
                                        </p>
                                    </div>
                                    <span
                                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                                            invoice.status
                                        )}`}
                                    >
                                        {getStatusLabel(invoice.status)}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">利用料金合計</p>
                                        <p className="text-3xl font-bold text-blue-600">
                                            ¥{invoice.totalAmount.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link href={`/invoices/${invoice.id}`}>
                                            <Button className="btn-primary">
                                                <FileText className="mr-2 h-4 w-4" />
                                                詳細を見る
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
