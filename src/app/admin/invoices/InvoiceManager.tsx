'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { generateInvoicesForQuarter } from './actions'
import { useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type Invoice = { id: string; userId: string; fiscalYear: number; quarter: number; totalAmount: number; status: string; sealedAt: Date | string | null; sealedBy: string | null; invoiceNumber: string; user: { name: string; department: string | null; laboratory: string | null } }
type Period = { key: string; year: number; quarter: number }
type UsageLog = { id: string; date: Date; quantity: number; totalCost: number; user: { id: string; name: string; role: string }; reagent: { name: string } }
type Reservation = { id: string; startTime: Date; endTime: Date; status: string; user: { name: string }; equipment: { name: string } }
type Props = { invoices: Invoice[]; periods: Period[]; selectedPeriod: Period; usageLogs: UsageLog[]; reservations: Reservation[]; canGenerate: boolean; generationComplete: boolean; hasGenerationTargets: boolean }

const quarterLabel = (quarter: number) => quarter === 1 ? '第1期（1-4月）' : quarter === 2 ? '第2期（5-8月）' : quarter === 3 ? '第3期（9-12月）' : `第${quarter}期`
const formatDate = (value: Date | string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value))
const formatDateTime = (value: Date | string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

function GenerateButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
    const { pending } = useFormStatus()
    return <Button type="submit" disabled={disabled || pending} className="btn-primary"><Plus className="mr-2 h-4 w-4" />{pending ? '生成中...' : children}</Button>
}

export default function InvoiceManager({ invoices, periods, selectedPeriod, usageLogs, reservations, canGenerate, generationComplete, hasGenerationTargets }: Props) {
    const [idempotencyKey] = useState(() => crypto.randomUUID())
    const filteredInvoices = invoices.filter((invoice) => invoice.fiscalYear === selectedPeriod.year && invoice.quarter === selectedPeriod.quarter)
    const totalUsage = usageLogs.reduce((total, log) => total + log.totalCost, 0)
    const generate = generateInvoicesForQuarter.bind(null, selectedPeriod.year, selectedPeriod.quarter)

    return <div className="content-wrapper py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1>請求書管理</h1><p className="mt-2 text-sm text-slate-500">すべての利用者の請求書を管理できます</p></div>
            {canGenerate && <form action={generate}><input type="hidden" name="idempotencyKey" value={idempotencyKey} /><GenerateButton disabled={generationComplete || !hasGenerationTargets}>{generationComplete ? 'この期間の請求書は生成済み' : !hasGenerationTargets ? '請求対象がありません' : `${selectedPeriod.year}年 ${quarterLabel(selectedPeriod.quarter)}の請求書を一括生成`}</GenerateButton></form>}
        </div>
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-medium text-gray-700">請求期間を選択</div>
            <div className="flex flex-wrap gap-2">{periods.map((period) => { const isSelected = period.key === selectedPeriod.key; return <Link key={period.key} href={`/admin/invoices?period=${period.key}`}><Button variant={isSelected ? 'default' : 'outline'} className={isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}>{period.year}年 {quarterLabel(period.quarter)}</Button></Link> })}</div>
            <p className="mt-3 text-sm text-blue-800">表示中: {selectedPeriod.year}年 {quarterLabel(selectedPeriod.quarter)}（請求期間の明細と発行対象を表示）</p>
        </div>
        <Card className="mb-8" style={{ backgroundColor: '#eff6ff', border: '2px solid #2563eb', borderRadius: '12px' }}>
            <CardHeader className="pb-2"><CardTitle className="text-lg font-medium text-blue-900">{selectedPeriod.year}年 {quarterLabel(selectedPeriod.quarter)} の集計</CardTitle></CardHeader>
            <CardContent><div className="flex flex-wrap gap-6 text-sm text-blue-800"><span>発行済み: {filteredInvoices.length}件</span><span>利用明細: {usageLogs.length}件</span><span>利用料金合計: ¥{totalUsage.toLocaleString()}</span><span>予約履歴: {reservations.length}件</span></div></CardContent>
        </Card>
        {filteredInvoices.length === 0 && <Card className="mb-8"><CardContent className="py-8 text-center text-gray-600"><FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" /><p>この期間の請求書はありません。</p>{hasGenerationTargets && canGenerate && <p className="mt-2 font-medium text-blue-700">請求書を発行してください。</p>}</CardContent></Card>}
        {filteredInvoices.length > 0 && <div className="mb-8 flex flex-col gap-8">{filteredInvoices.map((invoice) => { const sealed = Boolean(invoice.sealedAt && invoice.sealedBy); return <Card key={invoice.id} className="card-elevated" style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '0 auto', width: '100%' }}><CardHeader><div className="flex items-center justify-between gap-4"><div><CardTitle className="mb-2 text-blue-700">{invoice.user.name}</CardTitle><p className="text-sm text-gray-600">請求書番号: {invoice.invoiceNumber}</p><p className="text-sm text-gray-600">{invoice.user.department} - {invoice.user.laboratory}</p></div><span className={`rounded-full px-3 py-1 text-sm font-medium ${sealed ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{sealed ? '押印済み' : invoice.status === 'issued' ? '発行済み' : invoice.status}</span></div></CardHeader><CardContent><div className="flex items-center justify-between"><div><p className="mb-1 text-sm text-gray-600">利用料金合計</p><p className="text-3xl font-bold text-blue-600">¥{invoice.totalAmount.toLocaleString()}</p></div><Link href={`/invoices/${invoice.id}?from=admin`}><Button className="btn-primary"><FileText className="mr-2 h-4 w-4" />詳細を見る</Button></Link></div></CardContent></Card> })}</div>}
        <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>利用明細（{selectedPeriod.year}年 {quarterLabel(selectedPeriod.quarter)}）</CardTitle></CardHeader><CardContent>{usageLogs.length === 0 ? <p className="text-sm text-slate-500">この期間の利用明細はありません。</p> : <div className="max-h-80 space-y-2 overflow-y-auto">{usageLogs.map((log) => <div key={log.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{formatDate(log.date)} {log.user.name} / {log.reagent.name} × {log.quantity}</span><span className="font-medium">¥{log.totalCost.toLocaleString()}</span></div>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle>予約履歴（{selectedPeriod.year}年 {quarterLabel(selectedPeriod.quarter)}）</CardTitle></CardHeader><CardContent>{reservations.length === 0 ? <p className="text-sm text-slate-500">この期間の予約履歴はありません。</p> : <div className="max-h-80 space-y-2 overflow-y-auto">{reservations.map((reservation) => <div key={reservation.id} className="border-b border-slate-100 py-2 text-sm"><div>{reservation.equipment.name} / {reservation.user.name}</div><div className="text-slate-500">{formatDateTime(reservation.startTime)} - {formatDateTime(reservation.endTime)}（{reservation.status}）</div></div>)}</div>}</CardContent></Card>
        </div>
    </div>
}
