'use client'

import { remindPassword } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8">
            <Card className="w-[450px] shadow-xl border-blue-100 overflow-hidden">
                <CardHeader className="text-center py-8 space-y-4" style={{ background: 'linear-gradient(to right, rgb(96 165 250), rgb(29 78 216))' }}>
                    <div className="flex justify-center">
                        <div className="bg-white rounded-full p-1 w-[80px] h-[80px] flex items-center justify-center">
                            <img
                                src="/images/kitasato-logo.png"
                                alt="Kitasato University Logo"
                                className="w-full h-full rounded-full"
                            />
                        </div>
                    </div>
                    <div className="font-bold tracking-wide" style={{ color: 'white', fontSize: '1.75rem' }}>
                        分子生物実験センター
                    </div>
                    <div className="font-medium" style={{ color: 'white', fontSize: '1.125rem', opacity: 0.9 }}>
                        パスワード通知
                    </div>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="space-y-5" style={{ paddingTop: '2.5rem', paddingBottom: '2.5rem', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
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
                                style={{ height: '3rem', fontSize: '1.125rem' }}
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
                                style={{ height: '3rem', fontSize: '1.125rem' }}
                                disabled={isSubmitting}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-2">
                        <Button
                            type="submit"
                            className="w-full btn-primary h-11 text-base"
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
