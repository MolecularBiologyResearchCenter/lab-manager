'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckSquare, FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { generateInvoicesForQuarter } from './actions'
import { useMemo, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type Invoice = { id: string; userId: string; fiscalYear: number; quarter: number; totalAmount: number; status: string; sealedAt: Date | string | null; sealedBy: string | null; invoiceNumber: string; user: { name: string; department: string | null; laboratory: string | null } }
type Period = { key: string; year: number; quarter: number }
type UsageLog = { id: string; date: Date; quantity: number; totalCost: number; user: { id: string; name: string; role: string }; reagent: { name: string } }
type Reservation = { id: string; startTime: Date; endTime: Date; status: string; user: { name: string }; equipment: { name: string } }
type Props = { invoices: Invoice[]; periods: Period[]; selectedPeriod: Period; usageLogs: UsageLog[]; reservations: Reservation[]; canGenerate: boolean; canBulkSeal: boolean; generationComplete: boolean; hasGenerationTargets: boolean }

const quarterLabel = (quarter: number) => quarter === 1 ? '第1期（1-4月）' : quarter === 2 ? '第2期（5-8月）' : quarter === 3 ? '第3期（9-12月）' : `第${quarter}期`
const formatDate = (value: Date | string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value))
const formatDateTime = (value: Date | string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

function GenerateButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
    const { pending } = useFormStatus()
    return <Button type="submit" disabled={disabled || pending} className="btn-primary"><Plus className="mr-2 h-4 w-4" />{pending ? '生成中...' : children}</Button>
}

export default function InvoiceManager({ invoices, periods, selectedPeriod, usageLogs, reservations, canGenerate, canBulkSeal, generationComplete, hasGenerationTargets }: Props) {
    const [idempotencyKey] = useState(() => crypto.randomUUID())
    const filteredInvoices = invoices.filter((invoice) => invoice.fiscalYear === selectedPeriod.year && invoice.quarter === selectedPeriod.quarter)
    const unsealedInvoices = useMemo(() => filteredInvoices.filter((invoice) => !invoice.sealedAt || !invoice.sealedBy), [filteredInvoices])
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
    const [bulkSealing, setBulkSealing] = useState(false)
    const [bulkMessage, setBulkMessage] = useState<string | null>(null)
    const totalUsage = usageLogs.reduce((total, log) => total + log.totalCost, 0)
    const generate = generateInvoicesForQuarter.bind(null, selectedPeriod.year, selectedPeriod.quarter)
    const selectedCount = selectedInvoiceIds.length
    const selectedTotal = unsealedInvoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)).reduce((total, invoice) => total + invoice.totalAmount, 0)
    const toggleInvoice = (invoiceId: string) => setSelectedInvoiceIds((current) => current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId])
    const toggleAll = () => setSelectedInvoiceIds(selectedCount === unsealedInvoices.length ? [] : unsealedInvoices.map((invoice) => invoice.id))
    const bulkSeal = async () => {
        if (selectedCount === 0 || bulkSealing) return
        if (!window.confirm(`未押印の請求書 ${selectedCount}件に電子印を押します。内容を確認しましたか？`)) return
        setBulkSealing(true)
        setBulkMessage(null)
        try {
            const response = await fetch('/api/invoices/bulk-seal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceIds: selectedInvoiceIds }) })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(payload?.error?.message || '一括押印に失敗しました。')
            const results = payload?.results || []
            const successCount = results.filter((result: { success: boolean }) => result.success).length
            const failureCount = results.length - successCount
            setBulkMessage(failureCount === 0 ? `${successCount}件の押印が完了しました。` : `${successCount}件を押印しました。${failureCount}件は失敗しました。対象を確認してください。`)
            setSelectedInvoiceIds(results.filter((result: { success: boolean }) => !result.success).map((result: { invoiceId: string }) => result.invoiceId))
            window.location.reload()
        } catch (error) {
            setBulkMessage(error instanceof Error ? error.message : '一括押印に失敗しました。')
        } finally {
            setBulkSealing(false)
        }
    }

    return <div className="content-wrapper py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1>請求書管理</h1><p className="mt-2 text-sm text-slate-500">すべての利用者の請求書を管理できます</p></div>
            {canGenerate && <form action={generate}><input type="hidden" name="idempotencyKey" value={idempotencyKey} /><GenerateButton disabled={generationComplete || !hasGenerationTargets}>{generationComplete ? 'この期間の請求書は生成済み' : !hasGenerationTargets ? '請求対象がありません' : `${selectedPeriod.year}年 ${quarterLabel(selectedPeriod.quarter)}の請求書を一括生成`}</GenerateButton></form>}
        </div>
        {canBulkSeal && filteredInvoices.length > 0 && <Card className="mb-8 border-2 border-amber-400 bg-amber-50"><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg text-amber-900">電子印の一括押印</CardTitle><p className="mt-1 text-sm text-amber-800">未押印の請求書だけを選択して、センター長が一度に押印できます。</p></div><Button type="button" disabled={selectedCount === 0 || bulkSealing} onClick={bulkSeal} className="bg-amber-600 text-white hover:bg-amber-700"><CheckSquare className="mr-2 h-4 w-4" />{bulkSealing ? '押印中...' : `選択した${selectedCount}件を押印`}</Button></div></CardHeader><CardContent><label className="flex items-center gap-2 text-sm font-medium text-amber-900"><input type="checkbox" checked={unsealedInvoices.length > 0 && selectedCount === unsealedInvoices.length} onChange={toggleAll} disabled={unsealedInvoices.length === 0 || bulkSealing} />未押印の請求書をすべて選択（{unsealedInvoices.length}件）</label><p className="mt-2 text-sm text-amber-800">選択中：{selectedCount}件 / 合計 ¥{selectedTotal.toLocaleString()}</p>{bulkMessage && <p className="mt-3 text-sm font-medium text-amber-900">{bulkMessage}</p>}</CardContent></Card>}
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
        {filteredInvoices.length > 0 && <div className="mb-8 flex flex-col gap-8">{filteredInvoices.map((invoice) => { const sealed = Boolean(invoice.sealedAt && invoice.sealedBy); return <Card key={invoice.id} className="card-elevated" style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '0 auto', width: '100%' }}><CardHeader><div className="flex items-center justify-between gap-4"><div className="flex items-start gap-3">{canBulkSeal && !sealed && <input type="checkbox" aria-label={`${invoice.user.name}の請求書を選択`} checked={selectedInvoiceIds.includes(invoice.id)} onChange={() => toggleInvoice(invoice.id)} disabled={bulkSealing} className="mt-1 h-5 w-5" />}<div><CardTitle className="mb-2 text-blue-700">{invoice.user.name}</CardTitle><p className="text-sm text-gray-600">請求書番号: {invoice.invoiceNumber}</p><p className="text-sm text-gray-600">{invoice.user.department} - {invoice.user.laboratory}</p></div></div><span className={`rounded-full px-3 py-1 text-sm font-medium ${sealed ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{sealed ? '押印済み' : invoice.status === 'issued' ? '発行済み' : invoice.status}</span></div></CardHeader><CardContent><div className="flex items-center justify-between"><div><p className="mb-1 text-sm text-gray-600">利用料金合計</p><p className="text-3xl font-bold text-blue-600">¥{invoice.totalAmount.toLocaleString()}</p></div><Link href={`/invoices/${invoice.id}?from=admin`}><Button className="btn-primary"><FileText className="mr-2 h-4 w-4" />詳細を見る</Button></Link></div></CardContent></Card> })}</div>}
        <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>利用明細（{selectedPeriod.year}年 {quarterLabel(selectedPeriod.quarter)}）</CardTitle></CardHeader><CardContent>{usageLogs.length === 0 ? <p className="text-sm text-slate-500">この期間の利用明細はありません。</p> : <div className="max-h-80 space-y-2 overflow-y-auto">{usageLogs.map((log) => <div key={log.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{formatDate(log.date)} {log.user.name} / {log.reagent.name} × {log.quantity}</span><span className="font-medium">¥{log.totalCost.toLocaleString()}</span></div>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle>予約履歴（{selectedPeriod.year}年 {quarterLabel(selectedPeriod.quarter)}）</CardTitle></CardHeader><CardContent>{reservations.length === 0 ? <p className="text-sm text-slate-500">この期間の予約履歴はありません。</p> : <div className="max-h-80 space-y-2 overflow-y-auto">{reservations.map((reservation) => <div key={reservation.id} className="border-b border-slate-100 py-2 text-sm"><div>{reservation.equipment.name} / {reservation.user.name}</div><div className="text-slate-500">{formatDateTime(reservation.startTime)} - {formatDateTime(reservation.endTime)}（{reservation.status}）</div></div>)}</div>}</CardContent></Card>
        </div>
    </div>
}
