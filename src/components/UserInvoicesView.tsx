'use client'

import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserLanguage } from '@/components/UserLanguageProvider'

type Invoice = {
    id: string
    fiscalYear: number
    quarter: number
    invoiceNumber: string
    totalAmount: number
    status: string
    sealedAt: Date | string | null
    sealedBy: string | null
}

export default function UserInvoicesView({ invoices }: { invoices: Invoice[] }) {
    const { t, language } = useUserLanguage()
    const quarterLabel = (quarter: number) => {
        if (language === 'en') {
            if (quarter === 1) return 'Q1 (Jan–Apr)'
            if (quarter === 2) return 'Q2 (May–Aug)'
            if (quarter === 3) return 'Q3 (Sep–Dec)'
        }
        if (quarter === 1) return '第1期（1–4月）'
        if (quarter === 2) return '第2期（5–8月）'
        if (quarter === 3) return '第3期（9–12月）'
        return language === 'en' ? `Q${quarter}` : `第${quarter}期`
    }
    const statusLabel = (status: string, sealed: boolean) => {
        if (sealed) return t('sealed')
        if (status === 'draft') return t('draft')
        if (status === 'issued') return t('issued')
        if (status === 'paid') return t('paid')
        return status
    }
    const statusClass = (status: string, sealed: boolean) => {
        if (sealed) return 'bg-red-50 text-red-700'
        if (status === 'issued') return 'bg-blue-50 text-blue-700'
        if (status === 'paid') return 'bg-emerald-50 text-emerald-700'
        return 'bg-slate-100 text-slate-600'
    }

    return (
        <div className="content-wrapper app-page">
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">{t('invoices')}</h1>
                    <p className="app-page-description">{t('invoiceDescription')}</p>
                </div>
            </div>
            {invoices.length === 0 ? (
                <div className="app-surface py-14 text-center text-slate-500">
                    <FileText className="mx-auto mb-4 h-10 w-10 text-slate-300" />
                    <p className="text-sm">{t('noInvoices')}</p>
                </div>
            ) : (
                <div className="app-surface overflow-hidden">
                    <div className="hidden grid-cols-[1.2fr_0.8fr_0.8fr_0.45fr] gap-4 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 md:grid">
                        <span>{t('period')}</span><span>{t('amount')}</span><span>{t('status')}</span><span />
                    </div>
                    <div className="divide-y divide-slate-100">
                        {invoices.map((invoice) => {
                            const sealed = Boolean(invoice.sealedAt && invoice.sealedBy)
                            return (
                                <div key={invoice.id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.45fr] md:gap-4 md:px-5">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{invoice.fiscalYear} {language === 'en' ? '' : '年度'} {quarterLabel(invoice.quarter)}</p>
                                        <p className="mt-1 text-[11px] text-slate-500 md:hidden">{invoice.invoiceNumber}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800 md:font-medium">¥{invoice.totalAmount.toLocaleString()}</p>
                                    <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(invoice.status, sealed)}`}>{statusLabel(invoice.status, sealed)}</span>
                                    <Link href={`/invoices/${invoice.id}`} className="col-start-2 row-span-2 row-start-1 md:col-auto md:row-auto">
                                        <Button variant="outline" size="sm" className="h-9 rounded-xl border-slate-300 px-3 text-slate-700"><span className="hidden md:inline">{t('details')}</span><ChevronRight className="h-4 w-4" /></Button>
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
