'use client'

import { getCurrentUser, updateProfile, uploadSeal } from '@/app/actions'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { User, Building, Phone, Mail, Lock, Pencil, Save, X } from 'lucide-react'
import { useState, useEffect } from 'react'
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
}

export default function MyPage() {
    const router = useRouter()
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)

    // Form states
    const [department, setDepartment] = useState('')
    const [laboratory, setLaboratory] = useState('')
    const [extension, setExtension] = useState('')

    // Password dialog states
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        loadUser()
    }, [])

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

    function startEditing() {
        if (!user) return
        setDepartment(user.department || '')
        setLaboratory(user.laboratory || '')
        setExtension(user.extension || '')
        setIsEditing(true)
    }

    function cancelEditing() {
        setIsEditing(false)
        if (user) {
            setDepartment(user.department || '')
            setLaboratory(user.laboratory || '')
            setExtension(user.extension || '')
        }
    }

    async function handleSaveProfile() {
        if (!user) return

        try {
            await updateProfile(user.id, {
                department,
                laboratory,
                extension
            })
            toast.success('プロフィールを更新しました')
            setIsEditing(false)
            loadUser() // Reload to get fresh data
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
            await updateProfile(user.id, {
                currentPassword,
                newPassword
            })
            toast.success('パスワードを変更しました')
            setPasswordDialogOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            loadUser()
        } catch (error) {
            toast.error('変更に失敗しました: ' + (error as Error).message)
        }
    }

    if (loading) {
        return <div className="container mx-auto py-8 text-center">読み込み中...</div>
    }

    if (!user) return null

    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6 text-center">マイページ</h1>

            <Card className="mx-auto shadow-md" style={{ maxWidth: '500px', backgroundColor: 'white' }}>
                <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-xl text-gray-800">ユーザー情報</CardTitle>
                    {!isEditing && (
                        <Button variant="outline" size="sm" onClick={startEditing} className="flex items-center gap-1">
                            <Pencil className="h-4 w-4" />
                            編集
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {/* Name (Read-only) */}
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                            <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500 font-medium">お名前</p>
                            <p className="text-lg font-bold text-gray-800">{user.name}</p>
                        </div>
                    </div>

                    {/* Department & Laboratory */}
                    <div className="flex items-start space-x-4">
                        <div className="bg-blue-100 p-3 rounded-full flex-shrink-0 mt-1">
                            <Building className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <p className="text-sm text-gray-500 font-medium mb-1">所属</p>
                                {isEditing ? (
                                    <Select value={department} onValueChange={setDepartment}>
                                        <SelectTrigger>
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
                                ) : (
                                    <p className="text-lg font-medium text-gray-800">{user.department}</p>
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium mb-1">研究室</p>
                                {isEditing ? (
                                    <Input
                                        value={laboratory}
                                        onChange={(e) => setLaboratory(e.target.value)}
                                        placeholder="研究室名"
                                    />
                                ) : (
                                    <p className="text-md text-gray-600">{user.laboratory}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Extension */}
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                            <Phone className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500 font-medium mb-1">内線番号</p>
                            {isEditing ? (
                                <Input
                                    value={extension}
                                    onChange={(e) => setExtension(e.target.value)}
                                    placeholder="内線番号"
                                />
                            ) : (
                                <p className="text-lg font-medium text-gray-800">{user.extension || '未登録'}</p>
                            )}
                        </div>
                    </div>

                    {/* Email (Read-only) */}
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                            <Mail className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500 font-medium">メールアドレス</p>
                            <p className="text-lg font-medium text-gray-800 break-all">{user.email}</p>
                        </div>
                    </div>

                    {/* Password */}
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                            <Lock className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">パスワード</p>
                                <p className="text-lg font-medium text-gray-800">********</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)}>
                                変更
                            </Button>
                        </div>
                    </div>
                </CardContent>
                {isEditing && (
                    <CardFooter className="flex justify-end gap-2 bg-gray-50 border-t py-4">
                        <Button variant="outline" onClick={cancelEditing} className="flex items-center gap-1">
                            <X className="h-4 w-4" />
                            キャンセル
                        </Button>
                        <Button onClick={handleSaveProfile} className="flex items-center gap-1">
                            <Save className="h-4 w-4" />
                            保存する
                        </Button>
                    </CardFooter>
                )}
            </Card>

            {/* Director Menu */}
            {user.role === 'CENTER_DIRECTOR' && (
                <div className="mt-8 max-w-[500px] mx-auto space-y-4">
                    <h2 className="text-xl font-bold mb-4 text-center">センター長メニュー</h2>

                    {/* Invoice Approval */}
                    <Link href="/admin/invoices">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-blue-50 border-blue-200">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-full">
                                        <Save className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-blue-900">請求書承認（電子印）</h3>
                                        <p className="text-sm text-blue-700">請求書を確認し、電子印を押します</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Seal Image Registration */}
                    <Card
                        className="hover:shadow-lg transition-shadow cursor-pointer bg-purple-50 border-purple-200"
                        onClick={() => document.getElementById('seal-upload-trigger')?.click()}
                    >
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-purple-600 p-3 rounded-full">
                                    <Pencil className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-purple-900">印鑑画像の登録</h3>
                                    <p className="text-sm text-purple-700">電子印として使用する画像を登録します</p>
                                </div>
                            </div>
                            <input
                                id="seal-upload-trigger"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return

                                    const formData = new FormData()
                                    formData.append('file', file)

                                    try {
                                        toast.info('アップロード中...')
                                        await uploadSeal(formData)
                                        toast.success('印鑑画像を登録しました')
                                        loadUser()
                                    } catch (error) {
                                        toast.error('アップロードに失敗しました: ' + (error as Error).message)
                                    }
                                }}
                            />
                        </CardContent>
                    </Card>

                    {/* Display Current Seal if exists */}
                    {/* Accessing user.sealImage safely. Assuming user type isn't fully updated in all contexts yet, we cast or use optional chaining if we updated the type definition */}
                    {(user as any).sealImage && (
                        <div className="text-center p-4 border rounded-lg bg-white">
                            <p className="text-sm text-gray-500 mb-2">現在の印鑑画像</p>
                            <img src={(user as any).sealImage} alt="Current Seal" className="mx-auto w-[60px] h-[60px] object-contain" />
                        </div>
                    )}
                </div>
            )}



            {/* Password Change Dialog */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent style={{ maxWidth: '320px', backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '12px' }}>
                    <DialogHeader>
                        <DialogTitle>パスワードの変更</DialogTitle>
                        <DialogDescription>
                            現在のパスワードと新しいパスワードを入力してください。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">現在のパスワード</Label>
                            <Input
                                id="current-password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full max-w-[240px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">新しいパスワード</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full max-w-[240px]"
                            />
                            <p className="text-xs text-gray-500">英小文字と数字を含む8文字以上</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full max-w-[240px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleChangePassword}>
                            変更する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
