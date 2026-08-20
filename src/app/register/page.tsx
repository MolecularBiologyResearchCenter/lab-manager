'use client'

import { register } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { toast } from 'sonner'
import { useState } from 'react'

export default function RegisterPage() {
    const [mailingList, setMailingList] = useState(true)

    async function handleSubmit(formData: FormData) {
        try {
            await register(formData)
        } catch (error) {
            toast.error((error as Error).message)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8">
            <Card className="w-[550px] shadow-xl border-blue-100 overflow-hidden">
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
                        利用者登録
                    </div>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="flex flex-col" style={{ gap: '1.75rem', paddingTop: '2.5rem', paddingBottom: '2.5rem', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lastName">氏名（姓）</Label>
                                <Input id="lastName" name="lastName" required placeholder="北里" style={{ height: '3rem', fontSize: '1.125rem' }} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="firstName">氏名（名）</Label>
                                <Input id="firstName" name="firstName" required placeholder="太郎" style={{ height: '3rem', fontSize: '1.125rem' }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lastNameKana">ふりがな（せい）</Label>
                                <Input id="lastNameKana" name="lastNameKana" required placeholder="きたさと" style={{ height: '3rem', fontSize: '1.125rem' }} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="firstNameKana">ふりがな（めい）</Label>
                                <Input id="firstNameKana" name="firstNameKana" required placeholder="たろう" style={{ height: '3rem', fontSize: '1.125rem' }} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="employeeId">職員番号/学籍番号</Label>
                            <Input id="employeeId" name="employeeId" required placeholder="12345678" style={{ height: '3rem', fontSize: '1.125rem' }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">メールアドレス</Label>
                            <Input id="email" name="email" type="email" required placeholder="user@example.com" style={{ height: '3rem', fontSize: '1.125rem' }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">
                                パスワード <span className="text-sm font-normal text-gray-500 ml-1">（英数小文字8文字以上）</span>
                            </Label>
                            <Input id="password" name="password" type="password" required style={{ height: '3rem', fontSize: '1.125rem' }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department">学部など</Label>
                            <Select name="department" required>
                                <SelectTrigger style={{ height: '4rem', fontSize: '1.25rem' }}>
                                    <SelectValue placeholder="学部を選択" />
                                </SelectTrigger>
                                <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false}>
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
                                    <SelectItem value="その他">その他</SelectItem>
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

                        <div className="space-y-3 pt-2">
                            <Label className="text-base">メーリングリスト登録</Label>
                            <div className="flex items-center h-12" style={{ gap: '4rem' }}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="mailingListRadio"
                                        checked={mailingList === true}
                                        onChange={() => setMailingList(true)}
                                        className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-lg">はい</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="mailingListRadio"
                                        checked={mailingList === false}
                                        onChange={() => setMailingList(false)}
                                        className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-lg">いいえ</span>
                                </label>
                            </div>
                            <input type="hidden" name="mailingList" value={mailingList.toString()} />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-2">
                        <Button type="submit" className="w-full btn-primary h-11" style={{ fontSize: '1.5rem' }}>
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
