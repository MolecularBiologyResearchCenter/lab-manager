'use client'

import { remindPassword } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardFooter } from '@/components/ui/card'
import Link from 'next/link'
import { toast } from 'sonner'
import { useState } from 'react'

export default function ForgotPasswordPage() {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true)
        try {
            await remindPassword(formData)
            toast.success('パスワードを記載したメールを送信しました。ご確認ください。')
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
            <Card className="w-full max-w-md overflow-hidden rounded-2xl border-slate-200 shadow-[0_16px_48px_rgba(30,64,175,0.10)]">
                <CardHeader className="space-y-3 bg-blue-700 py-7 text-center">
                    <div className="flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white p-1">
                            <img
                                src="/images/kitasato-logo.png"
                                alt="Kitasato University Logo"
                                className="w-full h-full rounded-full"
                            />
                        </div>
                    </div>
                    <div className="text-xl font-semibold tracking-wide text-white">
                        分子生物実験センター
                    </div>
                    <div className="text-sm font-medium text-blue-100">
                        パスワード通知
                    </div>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="space-y-5 px-6 py-7">
                        <CardDescription className="text-center text-gray-600">
                            登録されているメールアドレスと職員番号を入力してください。<br />
                            パスワードをメールでお知らせします。
                        </CardDescription>
                        <div className="space-y-2">
                            <Label htmlFor="email">メールアドレス</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="user@example.com"
                                className="h-11 rounded-xl border-slate-300 text-base"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="employeeId">職員番号/学籍番号</Label>
                            <Input
                                id="employeeId"
                                name="employeeId"
                                required
                                placeholder="12345678"
                                className="h-11 rounded-xl border-slate-300 text-base"
                                disabled={isSubmitting}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 px-6 pb-7">
                        <Button
                            type="submit"
                            className="h-12 w-full rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '送信中...' : 'パスワードを通知する'}
                        </Button>
                        <div className="text-sm text-center text-gray-600">
                            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                                ログイン画面に戻る
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
