'use client'

import { getCurrentUser, updateProfile, uploadSeal } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building, FileCheck, KeyRound, Mail, Pencil, Phone, Save, Upload, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type UserData = {
    id: string
    name: string
    email: string
    department: string
    laboratory: string
    extension: string | null
    role: string
    password?: string
    sealImage?: string | null
}

export default function MyPage() {
    const router = useRouter()
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [department, setDepartment] = useState('')
    const [laboratory, setLaboratory] = useState('')
    const [extension, setExtension] = useState('')
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    async function loadUser() {
        try {
            const userData = await getCurrentUser()
            if (!userData) {
                router.push('/login')
                return
            }
            setUser(userData as UserData)
            setDepartment(userData.department || '')
            setLaboratory(userData.laboratory || '')
            setExtension(userData.extension || '')
        } catch (error) {
            console.error('Failed to load user:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadUser()
    }, [])

    function startEditing() {
        if (!user) return
        setDepartment(user.department || '')
        setLaboratory(user.laboratory || '')
        setExtension(user.extension || '')
        setIsEditing(true)
    }

    function cancelEditing() {
        setIsEditing(false)
        if (!user) return
        setDepartment(user.department || '')
        setLaboratory(user.laboratory || '')
        setExtension(user.extension || '')
    }

    async function handleSaveProfile() {
        if (!user) return
        try {
            await updateProfile(user.id, { department, laboratory, extension })
            toast.success('プロフィールを更新しました')
            setIsEditing(false)
            await loadUser()
            router.refresh()
        } catch (error) {
            toast.error('更新に失敗しました: ' + (error as Error).message)
        }
    }

    async function handleChangePassword() {
        if (!user) return
        if (newPassword !== confirmPassword) {
            toast.error('新しいパスワードが一致しません')
            return
        }
        try {
            await updateProfile(user.id, { currentPassword, newPassword })
            toast.success('パスワードを変更しました')
            setPasswordDialogOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            await loadUser()
        } catch (error) {
            toast.error('変更に失敗しました: ' + (error as Error).message)
        }
    }

    async function handleSealUpload(file?: File) {
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        try {
            toast.info('アップロード中...')
            await uploadSeal(formData)
            toast.success('印鑑画像を登録しました')
            await loadUser()
        } catch (error) {
            toast.error('アップロードに失敗しました: ' + (error as Error).message)
        }
    }

    if (loading) return <div className="content-wrapper app-page text-center text-sm text-slate-500">読み込み中...</div>
    if (!user) return null

    const departments = ['医学部', '医療衛生学部', '理学部', '海洋生命学部', '獣医学部', '未来工学部', '薬学部', '一般教育学部', 'KMC', '新潟', 'その他']

    return (
        <div className="content-wrapper app-page">
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">マイページ</h1>
                    <p className="app-page-description">登録情報とアカウント設定</p>
                </div>
                {!isEditing && (
                    <Button variant="outline" onClick={startEditing} className="h-10 rounded-xl border-slate-300 bg-white px-4 text-slate-700">
                        <Pencil className="h-4 w-4" />
                        編集
                    </Button>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <section className="app-surface p-6 text-center">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-blue-50 text-blue-700">
                        <UserRound className="h-9 w-9" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-800">{user.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">{user.role === 'ADMIN' ? '管理者' : user.role === 'CENTER_DIRECTOR' ? 'センター長' : '一般ユーザー'}</p>
                </section>

                <section className="app-surface divide-y divide-slate-100 px-5 md:px-6">
                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><Building className="h-4 w-4 text-slate-400" />所属</span>
                        {isEditing ? (
                            <Select value={department} onValueChange={setDepartment}>
                                <SelectTrigger className="h-11 rounded-xl border-slate-300"><SelectValue placeholder="学部を選択" /></SelectTrigger>
                                <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false} className="bg-white">
                                    {departments.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : <strong className="text-sm font-medium text-slate-800">{user.department || '未登録'}</strong>}
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label">研究室</span>
                        {isEditing ? <Input value={laboratory} onChange={e => setLaboratory(e.target.value)} placeholder="研究室名" className="h-11 rounded-xl border-slate-300" /> : <strong className="text-sm font-medium text-slate-800">{user.laboratory || '未登録'}</strong>}
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />内線番号</span>
                        {isEditing ? <Input value={extension} onChange={e => setExtension(e.target.value)} placeholder="内線番号" className="h-11 rounded-xl border-slate-300" /> : <strong className="text-sm font-medium text-slate-800">{user.extension || '未登録'}</strong>}
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />メール</span>
                        <strong className="break-all text-sm font-medium text-slate-800">{user.email}</strong>
                    </div>

                    <div className="grid gap-3 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" />パスワード</span>
                        <div className="flex items-center justify-between gap-3">
                            <strong className="text-sm font-medium tracking-wider text-slate-800">••••••••</strong>
                            <Button variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)} className="rounded-xl border-slate-300">変更する</Button>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex justify-end gap-2 py-4">
                            <Button variant="outline" onClick={cancelEditing} className="rounded-xl border-slate-300"><X className="h-4 w-4" />キャンセル</Button>
                            <Button onClick={handleSaveProfile} className="rounded-xl bg-blue-700 text-white hover:bg-blue-800"><Save className="h-4 w-4" />保存する</Button>
                        </div>
                    )}
                </section>
            </div>

            {user.role === 'CENTER_DIRECTOR' && (
                <section className="mt-6">
                    <h2 className="mb-3 text-sm font-semibold text-slate-800">センター長メニュー</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Link href="/admin/invoices" className="app-surface flex min-h-20 items-center gap-4 p-4 transition hover:shadow-md">
                            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileCheck className="h-5 w-5" /></span>
                            <span><strong className="block text-sm font-semibold text-slate-800">請求書承認</strong><span className="mt-1 block text-xs text-slate-500">請求書を確認して電子印を押す</span></span>
                        </Link>
                        <label className="app-surface flex min-h-20 cursor-pointer items-center gap-4 p-4 transition hover:shadow-md">
                            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Upload className="h-5 w-5" /></span>
                            <span><strong className="block text-sm font-semibold text-slate-800">印鑑画像の登録</strong><span className="mt-1 block text-xs text-slate-500">電子印として使用する画像</span></span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleSealUpload(e.target.files?.[0])} />
                        </label>
                    </div>
                    {user.sealImage && (
                        <div className="app-surface mt-3 flex items-center gap-4 p-4">
                            <img src={user.sealImage} alt="現在の印鑑画像" className="h-14 w-14 object-contain" />
                            <span className="text-sm text-slate-600">現在の印鑑画像</span>
                        </div>
                    )}
                </section>
            )}

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent className="max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <DialogHeader>
                        <DialogTitle>パスワードの変更</DialogTitle>
                        <DialogDescription>現在のパスワードと新しいパスワードを入力してください。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2"><Label htmlFor="current-password">現在のパスワード</Label><Input id="current-password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="h-11 rounded-xl" /></div>
                        <div className="space-y-2"><Label htmlFor="new-password">新しいパスワード</Label><Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-11 rounded-xl" /><p className="text-xs text-slate-500">英小文字と数字を含む8文字以上</p></div>
                        <div className="space-y-2"><Label htmlFor="confirm-password">新しいパスワード（確認）</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-11 rounded-xl" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} className="rounded-xl">キャンセル</Button>
                        <Button onClick={handleChangePassword} className="rounded-xl bg-blue-700 text-white hover:bg-blue-800">変更する</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
