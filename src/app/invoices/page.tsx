import { getCurrentUser } from '../actions'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function InvoicesPage() {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const invoices = await prisma.invoice.findMany({
        where: { userId: user.id },
        orderBy: [{ fiscalYear: 'desc' }, { quarter: 'desc' }],
    })

    const getQuarterLabel = (quarter: number) => {
        switch (quarter) {
            case 1: return '第1期（1–4月）'
            case 2: return '第2期（5–8月）'
            case 3: return '第3期（9–12月）'
            default: return `第${quarter}期`
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return '下書き'
            case 'issued': return '発行済み'
            case 'paid': return '支払済み'
            default: return status
        }
    }

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'issued': return 'bg-blue-50 text-blue-700'
            case 'paid': return 'bg-emerald-50 text-emerald-700'
            default: return 'bg-slate-100 text-slate-600'
        }
    }

    return (
        <div className="content-wrapper app-page">
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">請求書</h1>
                    <p className="app-page-description">4か月ごとの利用料金を確認</p>
                </div>
            </div>

            {invoices.length === 0 ? (
                <div className="app-surface py-14 text-center text-slate-500">
                    <FileText className="mx-auto mb-4 h-10 w-10 text-slate-300" />
                    <p className="text-sm">請求書はまだありません</p>
                </div>
            ) : (
                <div className="app-surface overflow-hidden">
                    <div className="hidden grid-cols-[1.2fr_0.8fr_0.8fr_0.45fr] gap-4 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 md:grid">
                        <span>期間</span>
                        <span>金額</span>
                        <span>状態</span>
                        <span></span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.45fr] md:gap-4 md:px-5">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{invoice.fiscalYear}年度 {getQuarterLabel(invoice.quarter)}</p>
                                    <p className="mt-1 text-[11px] text-slate-500 md:hidden">{invoice.invoiceNumber}</p>
                                </div>
                                <p className="text-sm font-semibold text-slate-800 md:font-medium">¥{invoice.totalAmount.toLocaleString()}</p>
                                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClass(invoice.status)}`}>
                                    {getStatusLabel(invoice.status)}
                                </span>
                                <Link href={`/invoices/${invoice.id}`} className="col-start-2 row-span-2 row-start-1 md:col-auto md:row-auto">
                                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-slate-300 px-3 text-slate-700">
                                        <span className="hidden md:inline">詳細</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
