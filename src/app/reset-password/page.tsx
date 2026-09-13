'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { resetPassword } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(formData: FormData) {
        const password = String(formData.get('password') || '')
        const confirmation = String(formData.get('confirmation') || '')
        if (password !== confirmation) {
            toast.error('新しいパスワードが一致しません。')
            return
        }

        setSubmitting(true)
        try {
            await resetPassword(searchParams.get('token') || '', password)
            toast.success('パスワードを再設定しました。')
            router.push('/login')
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
            <Card className="w-full max-w-md overflow-hidden rounded-2xl border-slate-200">
                <CardHeader className="bg-blue-700 py-7 text-center text-xl font-semibold text-white">
                    パスワード再設定
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="space-y-5 px-6 py-7">
                        <div className="space-y-2">
                            <Label htmlFor="password">新しいパスワード</Label>
                            <Input id="password" name="password" type="password" required disabled={submitting} />
                            <p className="text-xs text-slate-500">英小文字と数字を含む8文字以上</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmation">新しいパスワード（確認）</Label>
                            <Input id="confirmation" name="confirmation" type="password" required disabled={submitting} />
                        </div>
                    </CardContent>
                    <CardFooter className="px-6 pb-7">
                        <Button type="submit" disabled={submitting} className="h-12 w-full bg-blue-700 text-white hover:bg-blue-800">
                            {submitting ? '再設定中...' : 'パスワードを再設定する'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">読み込み中...</div>}>
            <ResetPasswordForm />
        </Suspense>
    )
}
