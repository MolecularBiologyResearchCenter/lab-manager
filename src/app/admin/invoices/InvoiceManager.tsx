'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { generateCurrentQuarterInvoices } from './actions'

type User = {
    name: string
    department: string | null
    laboratory: string | null
}

type Invoice = {
    id: string
    fiscalYear: number
    quarter: number
    totalAmount: number
    status: string
    invoiceNumber: string
    user: User
    createdAt: Date
    updatedAt: Date
}

type Props = {
    invoices: Invoice[]
}

export default function InvoiceManager({ invoices }: Props) {
    // Helper functions
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

    // Calculate summaries
    const termSummaries = useMemo(() => {
        const summaries = invoices.reduce((acc, invoice) => {
            const key = `${invoice.fiscalYear}-${invoice.quarter}`
            if (!acc[key]) {
                acc[key] = {
                    key,
                    fiscalYear: invoice.fiscalYear,
                    quarter: invoice.quarter,
                    totalAmount: 0,
                    count: 0,
                }
            }
            acc[key].totalAmount += invoice.totalAmount
            acc[key].count += 1
            return acc
        }, {} as Record<string, { key: string; fiscalYear: number; quarter: number; totalAmount: number; count: number }>)

        return Object.values(summaries).sort((a, b) => {
            if (a.fiscalYear !== b.fiscalYear) return b.fiscalYear - a.fiscalYear
            return b.quarter - a.quarter
        })
    }, [invoices])

    // State for selected term
    const [selectedTerm, setSelectedTerm] = useState<string | null>(() => {
        if (termSummaries.length > 0) {
            return termSummaries[0].key
        }
        return null
    })

    // Filter invoices
    const filteredInvoices = useMemo(() => {
        if (!selectedTerm) return []
        return invoices.filter(
            (inv) => `${inv.fiscalYear}-${inv.quarter}` === selectedTerm
        )
    }, [invoices, selectedTerm])

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

            {/* Term Selection Buttons */}
            {termSummaries.length > 0 && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm font-medium text-gray-700 mr-2">期間:</span>
                        {termSummaries.map((summary) => {
                            const isSelected = selectedTerm === summary.key
                            return (
                                <Button
                                    key={summary.key}
                                    variant={isSelected ? 'default' : 'outline'}
                                    onClick={() => setSelectedTerm(summary.key)}
                                    className="transition-all"
                                >
                                    {summary.fiscalYear}年 {getQuarterLabel(summary.quarter)}
                                </Button>
                            )
                        })}
                    </div>

                    {/* Selected Term Summary */}
                    {selectedTerm && (() => {
                        const summary = termSummaries.find(s => s.key === selectedTerm)
                        if (!summary) return null
                        return (
                            <Card style={{ backgroundColor: '#eff6ff', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', margin: '0 auto', marginBottom: '32px' }}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-medium text-blue-900">
                                        {summary.fiscalYear}年 {getQuarterLabel(summary.quarter)} の合計
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-blue-700">請求書発行数: {summary.count}件</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-sm text-blue-700">合計請求額:</span>
                                            <span className="text-3xl font-bold text-blue-800">
                                                ¥{summary.totalAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })()}
                </div>
            )}

            <div className="mt-8"></div>

            {/* Invoices List */}
            {filteredInvoices.length === 0 ? (
                <Card className="card-elevated">
                    <CardContent className="py-12">
                        <div className="text-center text-gray-500">
                            <FileText className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                            <p>
                                {selectedTerm
                                    ? 'この期間の請求書はありません'
                                    : '請求書はまだありません'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-8">
                    {filteredInvoices.map((invoice) => (
                        <Card key={invoice.id} className="card-elevated hover:shadow-xl transition-shadow" style={{ backgroundColor: 'white', border: '2px solid #2563eb', borderRadius: '12px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto', marginBottom: '32px', width: '100%' }}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-blue-700 mb-2">
                                            {invoice.user.name}
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
