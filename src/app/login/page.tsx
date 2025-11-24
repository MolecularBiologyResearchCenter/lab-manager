'use client'

import { login } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            <Card className="w-[450px] shadow-xl border-blue-100 overflow-hidden">
                <CardHeader className="header-gradient text-center py-8 space-y-4">
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
                        利用者登録
                    </div>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="space-y-12" style={{ paddingTop: '2.5rem', paddingBottom: '2.5rem' }}>
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-gray-700">メールアドレス</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="user@example.com"
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                style={{ height: '3rem', fontSize: '1.125rem' }}
                            />
                        </div>
                        <div className="space-y-2" style={{ marginTop: '3rem' }}>
                            <Label htmlFor="password" className="text-gray-700">パスワード</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                style={{ height: '3rem', fontSize: '1.125rem' }}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-5 pt-4 pb-6">
                        <Button type="submit" className="w-full btn-primary h-11 text-base">
                            ログイン
                        </Button>
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
