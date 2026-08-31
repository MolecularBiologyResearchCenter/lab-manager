'use client'

import { login } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardFooter } from '@/components/ui/card'
import Link from 'next/link'
import { toast } from 'sonner'

export default function LoginPage() {
    const handleSubmit = async (formData: FormData) => {
        try {
            await login(formData)
        } catch (error) {
            toast.error((error as Error).message)
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
                        ログイン
                    </div>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="space-y-5 px-6 py-7">
                        <div className="text-center">
                            <CardDescription className="text-center text-gray-600">
                                メールアドレスとパスワードを入力してください
                            </CardDescription>
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-gray-700">メールアドレス</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="user@example.com"
                                className="h-11 rounded-xl border-slate-300 text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-700">パスワード</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="h-11 rounded-xl border-slate-300 text-base"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 px-6 pb-7">
                        <Button type="submit" className="h-12 w-full rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800">
                            ログイン
                        </Button>
                        <div className="text-sm text-center text-gray-600">
                            <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                                パスワードを忘れた方はこちら
                            </Link>
                        </div>
                        <div className="text-sm text-center text-gray-600">
                            アカウントをお持ちでない方は{' '}
                            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                                新規登録
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
