'use client'

import { register } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
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
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
            <Card className="w-full max-w-xl overflow-hidden rounded-2xl border-slate-200 shadow-[0_16px_48px_rgba(30,64,175,0.10)]">
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
                        利用者登録
                    </div>
                </CardHeader>
                <form action={handleSubmit}>
                    <CardContent className="flex flex-col gap-5 px-6 py-7 md:px-8">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lastName">氏名（姓）</Label>
                                <Input id="lastName" name="lastName" required placeholder="北里" className="h-11 rounded-xl border-slate-300 text-base" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="firstName">氏名（名）</Label>
                                <Input id="firstName" name="firstName" required placeholder="太郎" className="h-11 rounded-xl border-slate-300 text-base" />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lastNameKana">ふりがな（せい）</Label>
                                <Input id="lastNameKana" name="lastNameKana" required placeholder="きたさと" className="h-11 rounded-xl border-slate-300 text-base" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="firstNameKana">ふりがな（めい）</Label>
                                <Input id="firstNameKana" name="firstNameKana" required placeholder="たろう" className="h-11 rounded-xl border-slate-300 text-base" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="employeeId">職員番号/学籍番号</Label>
                            <Input id="employeeId" name="employeeId" required placeholder="12345678" className="h-11 rounded-xl border-slate-300 text-base" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">メールアドレス</Label>
                            <Input id="email" name="email" type="email" required placeholder="user@example.com" className="h-11 rounded-xl border-slate-300 text-base" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">
                                パスワード <span className="text-sm font-normal text-gray-500 ml-1">（英数小文字8文字以上）</span>
                            </Label>
                            <Input id="password" name="password" type="password" required className="h-11 rounded-xl border-slate-300 text-base" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department">学部など</Label>
                            <Select name="department" required>
                                <SelectTrigger className="h-11 rounded-xl border-slate-300 text-base">
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
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="laboratory">研究室</Label>
                                <Input id="laboratory" name="laboratory" placeholder="〇〇研究室" required className="h-11 rounded-xl border-slate-300 text-base" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="extension">内線</Label>
                                <Input id="extension" name="extension" placeholder="590-1234" className="h-11 rounded-xl border-slate-300 text-base" />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Label className="text-base">メーリングリスト登録</Label>
                            <div className="flex min-h-12 items-center gap-10">
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
                    <CardFooter className="flex flex-col space-y-4 px-6 pb-7 md:px-8">
                        <Button type="submit" className="h-12 w-full rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800">
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
