'use client'

import { getCurrentUser, updateProfile } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building, KeyRound, Mail, Pencil, Phone, Save, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { showError } from '@/lib/error-notifier'
import { useUserLanguage } from '@/components/UserLanguageProvider'

type UserData = {
    id: string
    name: string
    email: string
    department: string
    laboratory: string
    extension: string | null
    employeeId: string | null
    mailingList: boolean
    role: string
    password?: string
}

export default function MyPage() {
    const router = useRouter()
    const { t } = useUserLanguage()
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [department, setDepartment] = useState('')
    const [laboratory, setLaboratory] = useState('')
    const [extension, setExtension] = useState('')
    const [mailingList, setMailingList] = useState(false)
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
            setMailingList(userData.mailingList)
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
        setMailingList(user.mailingList)
        setIsEditing(true)
    }

    function cancelEditing() {
        setIsEditing(false)
        if (!user) return
        setDepartment(user.department || '')
        setLaboratory(user.laboratory || '')
        setExtension(user.extension || '')
        setMailingList(user.mailingList)
    }

    async function handleSaveProfile() {
        if (!user) return
        try {
            await updateProfile(user.id, { department, laboratory, extension, mailingList })
            toast.success(t('recorded'))
            setIsEditing(false)
            await loadUser()
            router.refresh()
        } catch (error) {
            showError('更新に失敗しました: ' + (error as Error).message)
        }
    }

    async function handleChangePassword() {
        if (!user) return
        if (newPassword !== confirmPassword) {
            showError(t('confirmPassword') + 'が一致しません')
            return
        }
        try {
            await updateProfile(user.id, { currentPassword, newPassword })
            toast.success(t('password') + 'を変更しました')
            setPasswordDialogOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            await loadUser()
        } catch (error) {
            showError('変更に失敗しました: ' + (error as Error).message)
        }
    }

    if (loading) return <div className="content-wrapper app-page text-center text-sm text-slate-500">Loading...</div>
    if (!user) return null

    const departments = ['医学部', '医療衛生学部', '理学部', '海洋生命学部', '獣医学部', '未来工学部', '薬学部', '一般教育学部', 'KMC', '新潟', 'その他']

    return (
        <div className="content-wrapper app-page">
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">{t('myPage')}</h1>
                    <p className="app-page-description">{t('profileSettings')}</p>
                </div>
                {!isEditing && (
                    <Button variant="outline" onClick={startEditing} className="h-10 rounded-xl border-slate-300 bg-white px-4 text-slate-700">
                        <Pencil className="h-4 w-4" />
                        {t('details')}
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
                        <span className="app-label flex items-center gap-2"><Building className="h-4 w-4 text-slate-400" />{t('department')}</span>
                        {isEditing ? (
                            <Select value={department} onValueChange={setDepartment}>
                                <SelectTrigger className="h-11 rounded-xl border-slate-300"><SelectValue placeholder={t('department')} /></SelectTrigger>
                                <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false} className="bg-white">
                                    {departments.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : <strong className="text-sm font-medium text-slate-800">{user.department || t('notRegistered')}</strong>}
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label">{t('laboratory')}</span>
                        {isEditing ? <Input value={laboratory} onChange={e => setLaboratory(e.target.value)} placeholder={t('laboratory')} className="h-11 rounded-xl border-slate-300" /> : <strong className="text-sm font-medium text-slate-800">{user.laboratory || t('notRegistered')}</strong>}
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{t('extension')}</span>
                        {isEditing ? <Input value={extension} onChange={e => setExtension(e.target.value)} placeholder={t('extension')} className="h-11 rounded-xl border-slate-300" /> : <strong className="text-sm font-medium text-slate-800">{user.extension || t('notRegistered')}</strong>}
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />メール</span>
                        <strong className="break-all text-sm font-medium text-slate-800">{user.email}</strong>
                    </div>

                    <div className="grid gap-2 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label">{t('employeeId')}</span>
                        <strong className="text-sm font-medium text-slate-800">{user.employeeId || t('notRegistered')}</strong>
                    </div>

                    <div className="grid gap-3 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label">{t('mailingList')}</span>
                        {isEditing ? (
                            <div className="flex flex-wrap items-center gap-5">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="radio"
                                        name="mypage-mailing-list"
                                        checked={mailingList}
                                        onChange={() => setMailingList(true)}
                                        className="h-4 w-4 accent-blue-700"
                                    />
                                    {t('joined')}
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="radio"
                                        name="mypage-mailing-list"
                                        checked={!mailingList}
                                        onChange={() => setMailingList(false)}
                                        className="h-4 w-4 accent-blue-700"
                                    />
                                    {t('notJoined')}
                                </label>
                            </div>
                        ) : <strong className="text-sm font-medium text-slate-800">{user.mailingList ? t('joined') : t('notJoined')}</strong>}
                    </div>

                    <div className="grid gap-3 py-5 md:grid-cols-[9rem_1fr] md:items-center">
                        <span className="app-label flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" />{t('password')}</span>
                        <div className="flex items-center justify-between gap-3">
                            <strong className="text-sm font-medium tracking-wider text-slate-800">••••••••</strong>
                            <Button variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)} className="rounded-xl border-slate-300">{t('changePassword')}</Button>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex justify-end gap-2 py-4">
                            <Button variant="outline" onClick={cancelEditing} className="rounded-xl border-slate-300"><X className="h-4 w-4" />{t('cancel')}</Button>
                            <Button onClick={handleSaveProfile} className="rounded-xl bg-blue-700 text-white hover:bg-blue-800"><Save className="h-4 w-4" />{t('save')}</Button>
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent className="max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <DialogHeader>
                        <DialogTitle>{t('changePassword')}</DialogTitle>
                        <DialogDescription>{t('passwordDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2"><Label htmlFor="current-password">{t('currentPassword')}</Label><Input id="current-password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="h-11 rounded-xl" /></div>
                        <div className="space-y-2"><Label htmlFor="new-password">{t('newPassword')}</Label><Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-11 rounded-xl" /><p className="text-xs text-slate-500">{t('passwordHint')}</p></div>
                        <div className="space-y-2"><Label htmlFor="confirm-password">{t('confirmPassword')}</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-11 rounded-xl" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} className="rounded-xl">{t('cancel')}</Button>
                        <Button onClick={handleChangePassword} className="rounded-xl bg-blue-700 text-white hover:bg-blue-800">{t('changePassword')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
