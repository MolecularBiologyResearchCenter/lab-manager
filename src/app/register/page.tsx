'use client'

import { register } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { toast } from 'sonner'

export default function RegisterPage() {
    const handleSubmit = async (formData: FormData) => {
        try {
            await register(formData)
        } catch (error) {
            toast.error((error as Error).message)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8">
            <Card className="w-[550px] shadow-xl border-blue-100 overflow-hidden">
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
                    <CardContent className="space-y-6" style={{ paddingTop: '2.5rem', paddingBottom: '2.5rem' }}>
                        <div className="space-y-3">
                            <Label htmlFor="name">氏名</Label>
                            <Input id="name" name="name" required placeholder="北里 太郎" style={{ height: '3rem', fontSize: '1.125rem' }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">メールアドレス</Label>
                            <Input id="email" name="email" type="email" required placeholder="user@example.com" style={{ height: '3rem', fontSize: '1.125rem' }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">パスワード</Label>
                            <Input id="password" name="password" type="password" required style={{ height: '3rem', fontSize: '1.125rem' }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department">学部など</Label>
                            <Select name="department" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="学部を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="医学部">医学部</SelectItem>
                                    <SelectItem value="医療衛生学部">医療衛生学部</SelectItem>
                                    <SelectItem value="理学部">理学部</SelectItem>
                                    <SelectItem value="海洋生命学部">海洋生命学部</SelectItem>
                                    <SelectItem value="獣医学部">獣医学部</SelectItem>
                                    <SelectItem value="未来工学部">未来工学部</SelectItem>
                                    <SelectItem value="薬学部">薬学部</SelectItem>
                                    <SelectItem value="一般教育学部">一般教育学部</SelectItem>
                                    <SelectItem value="KMC">KMC</SelectItem>
                                    <SelectItem value="新潟">新潟</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="laboratory">研究室</Label>
                                <Input id="laboratory" name="laboratory" placeholder="〇〇研究室" required style={{ height: '3rem', fontSize: '1.125rem' }} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="extension">内線</Label>
                                <Input id="extension" name="extension" placeholder="590-1234" style={{ height: '3rem', fontSize: '1.125rem' }} />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-2">
                        <Button type="submit" className="w-full btn-primary h-11 text-base">
                            登録する
                        </Button>
                        <div className="text-sm text-center text-gray-600">
                            既にアカウントをお持ちの方は{' '}
                            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                                ログイン
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
