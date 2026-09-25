'use client'

import { useState } from 'react'
import { Check, KeyRound } from 'lucide-react'
import { getPasswordResetRequests, issuePasswordResetCode } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { showError } from '@/lib/error-notifier'
import { formatTokyoDateTime } from '@/lib/date-format'

type ResetRequest = Awaited<ReturnType<typeof getPasswordResetRequests>>[number]

export default function AdminPasswordResetRequests({ initialRequests }: { initialRequests: ResetRequest[] }) {
    const [requests, setRequests] = useState(initialRequests)
    const [issuedCode, setIssuedCode] = useState<{ requestId: string; code: string; expiresAt: string } | null>(null)
    const [issuingId, setIssuingId] = useState<string | null>(null)

    const issueCode = async (requestId: string) => {
        setIssuingId(requestId)
        try {
            const result = await issuePasswordResetCode(requestId)
            setIssuedCode({ requestId, ...result })
            setRequests((current) => current.filter((request) => request.id !== requestId))
        } catch (error) {
            showError((error as Error).message)
        } finally {
            setIssuingId(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-blue-700" />
                    パスワード再設定依頼
                    {requests.length > 0 && (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                            {requests.length}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {issuedCode && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                        <p className="font-semibold text-amber-900">本人確認後、このコードを利用者へ安全に伝えてください。</p>
                        <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-wider text-slate-900">{issuedCode.code}</p>
                        <p className="mt-2 text-xs text-amber-800">有効期限：{formatTokyoDateTime(issuedCode.expiresAt)}（表示は今回限りです）</p>
                    </div>
                )}
                {requests.length === 0 ? (
                    <p className="text-sm text-slate-500">未処理の再設定依頼はありません。</p>
                ) : (
                    requests.map((request) => (
                        <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-medium text-slate-800">{request.user.name}</p>
                                <p className="text-sm text-slate-600">{request.user.department || '学部未登録'} / {request.user.laboratory || '所属・研究室未登録'}</p>
                                <p className="text-sm text-slate-600">職員番号：{request.user.employeeId || '未登録'} ・ 依頼日時：{formatTokyoDateTime(request.createdAt)}</p>
                            </div>
                            <Button type="button" onClick={() => issueCode(request.id)} disabled={issuingId !== null} className="shrink-0">
                                <Check className="mr-1 h-4 w-4" />
                                {issuingId === request.id ? '発行中...' : 'リセットコードを発行'}
                            </Button>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
