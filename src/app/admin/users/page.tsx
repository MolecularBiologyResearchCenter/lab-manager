'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { deleteUser, updateUserProfileByAdmin } from '@/app/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil } from 'lucide-react'
import { ApiClientError, formatApiError, readApiError } from '@/lib/api-client'

interface User {
    id: string
    name: string
    email: string
    employeeId: string | null
    mailingList: boolean
    role: string
    department: string | null
    laboratory: string | null
    extension: string | null
    createdAt: Date
}

const roleLabels: Record<string, string> = {
    ADMIN: '管理者',
    CENTER_DIRECTOR: 'センター長',
    USER: '一般利用者',
}

export default function UsersPage() {
    const router = useRouter()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string } | null>(null)
    const [deleteNameConfirmation, setDeleteNameConfirmation] = useState('')

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [userToEdit, setUserToEdit] = useState<User | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>('USER')
    const [employeeId, setEmployeeId] = useState('')
    const [mailingList, setMailingList] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users')
            if (!response.ok) {
                const apiError = await readApiError(response, '利用者一覧を取得できませんでした。')
                console.error('利用者一覧の取得に失敗しました。', apiError)
                toast.error(formatApiError(apiError))
                return
            }
            const data = await response.json()
            setUsers(data)
        } catch (error) {
            console.error('Failed to fetch users:', error)
            const apiError = new ApiClientError({
                error: '利用者一覧を取得できませんでした。',
                guidance: 'ネットワーク接続を確認して、もう一度お試しください。',
                requestId: '問い合わせ番号を取得できませんでした',
            })
            toast.error(formatApiError(apiError))
        } finally {
            setLoading(false)
        }
    }

    const openDeleteDialog = (e: React.MouseEvent, user: User) => {
        e.preventDefault()
        e.stopPropagation()
        setUserToDelete({ id: user.id, name: user.name, email: user.email })
        setDeleteNameConfirmation('')
        setDeleteDialogOpen(true)
    }

    const openEditDialog = (e: React.MouseEvent, user: User) => {
        e.preventDefault()
        e.stopPropagation()
        setUserToEdit(user)
        setSelectedRole(user.role)
        setEmployeeId(user.employeeId || '')
        setMailingList(user.mailingList)
        setEditDialogOpen(true)
    }

    const confirmDelete = async () => {
        if (!userToDelete || deleteNameConfirmation !== userToDelete.name) return

        try {
            await deleteUser(userToDelete.id)
            toast.success('ユーザーを削除しました')
            // Refresh the page to show updated list
            router.refresh()
            // Also refetch to update local state
            fetchUsers()
        } catch (error) {
            toast.error('削除に失敗しました: ' + (error as Error).message)
        }

        setDeleteDialogOpen(false)
        setUserToDelete(null)
        setDeleteNameConfirmation('')
    }

    const confirmUpdate = async () => {
        if (!userToEdit) return

        try {
            await updateUserProfileByAdmin(userToEdit.id, { role: selectedRole, employeeId, mailingList })
            toast.success('利用者情報を更新しました')
            router.refresh()
            fetchUsers()
        } catch (error) {
            toast.error('更新に失敗しました: ' + (error as Error).message)
        }

        setEditDialogOpen(false)
        setUserToEdit(null)
        setEmployeeId('')
        setMailingList(false)
    }

    const cancelDelete = () => {
        setDeleteDialogOpen(false)
        setUserToDelete(null)
        setDeleteNameConfirmation('')
    }

    const cancelEdit = () => {
        setEditDialogOpen(false)
        setUserToEdit(null)
    }

    if (loading) {
        return (
            <div className="content-wrapper space-y-8 py-8">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1>利用者一覧</h1>
                </div>
                <Card>
                    <CardContent className="py-8">
                        <p className="text-center text-gray-500">読み込み中...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="content-wrapper space-y-8 py-8">
            <div className="flex items-center gap-4">
                <Link href="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1>利用者一覧</h1>
                    <p className="mt-2 text-sm text-slate-500">登録情報と管理権限を確認・変更できます</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                {(['ADMIN', 'CENTER_DIRECTOR', 'USER'] as const).map((role) => (
                    <Card key={role} className="card-elevated">
                        <CardContent className="p-5">
                            <p className="text-sm text-slate-500">{roleLabels[role]}</p>
                            <p className="mt-2 text-3xl font-bold text-slate-800">
                                {users.filter((user) => user.role === role).length}名
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <CardTitle>登録ユーザー ({users.length}名)</CardTitle>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => { window.location.href = '/api/admin/users/export' }}
                        className="shrink-0"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        職員番号CSVをダウンロード
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>名前</TableHead>
                                    <TableHead>メールアドレス</TableHead>
                                    <TableHead>職員番号</TableHead>
                                    <TableHead>メーリングリスト</TableHead>
                                    <TableHead>権限</TableHead>
                                    <TableHead>所属</TableHead>
                                    <TableHead>研究室</TableHead>
                                    <TableHead>内線</TableHead>
                                    <TableHead>登録日</TableHead>
                                    <TableHead className="text-center">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user, index) => (
                                    <TableRow key={user.id} style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : { backgroundColor: '#ffffff' }}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.employeeId || '未登録'}</TableCell>
                                        <TableCell>{user.mailingList ? '参加する' : '参加しない'}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                                                    user.role === 'CENTER_DIRECTOR' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-blue-100 text-blue-800'
                                                }`}>
                                                {roleLabels[user.role] ?? '一般利用者'}
                                            </span>
                                        </TableCell>
                                        <TableCell>{user.department || '-'}</TableCell>
                                        <TableCell>{user.laboratory || '-'}</TableCell>
                                        <TableCell>{user.extension || '-'}</TableCell>
                                        <TableCell>
                                            {new Date(user.createdAt).toLocaleDateString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit'
                                            })}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => openEditDialog(e, user)}
                                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => openDeleteDialog(e, user)}
                                                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white">
                    <DialogHeader>
                        <DialogTitle>利用者情報の変更</DialogTitle>
                        <DialogDescription>
                            {userToEdit?.name} さんの職員番号、メーリングリスト、権限を変更します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="rounded-xl bg-slate-50 p-4 text-sm">
                            <p className="font-medium text-slate-800">変更前 → 変更後</p>
                            <p className="mt-1 text-slate-600">{userToEdit && roleLabels[userToEdit.role]} → {roleLabels[selectedRole]}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-employee-id">職員番号</Label>
                            <input
                                id="admin-employee-id"
                                value={employeeId}
                                onChange={(event) => setEmployeeId(event.target.value)}
                                placeholder="未登録"
                                maxLength={100}
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                            <Label htmlFor="admin-mailing-list">メーリングリスト</Label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                    id="admin-mailing-list"
                                    type="checkbox"
                                    checked={mailingList}
                                    onChange={(event) => setMailingList(event.target.checked)}
                                    className="h-4 w-4 accent-blue-700"
                                />
                                参加する
                            </label>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">権限</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="権限を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USER">一般利用者</SelectItem>
                                    <SelectItem value="CENTER_DIRECTOR">センター長</SelectItem>
                                    <SelectItem value="ADMIN">管理者</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">
                            権限によってアクセスできる画面や実行できる操作が変わります。変更内容は監査ログに記録されます。
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelEdit}>
                            キャンセル
                        </Button>
                        <Button
                            onClick={confirmUpdate}
                            disabled={!userToEdit || (
                                selectedRole === userToEdit.role &&
                                employeeId === (userToEdit.employeeId || '') &&
                                mailingList === userToEdit.mailingList
                            )}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white">
                    <DialogHeader>
                        <DialogTitle>削除の確認</DialogTitle>
                        <DialogDescription>
                            本当に次の利用者を削除しますか？この操作は取り消せません。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                        <p><span className="font-medium">氏名：</span>{userToDelete?.name}</p>
                        <p><span className="font-medium">メールアドレス：</span>{userToDelete?.email}</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="delete-name-confirmation">確認のため氏名を入力してください</Label>
                        <input
                            id="delete-name-confirmation"
                            value={deleteNameConfirmation}
                            onChange={(event) => setDeleteNameConfirmation(event.target.value)}
                            placeholder={userToDelete?.name}
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDelete}>
                            キャンセル
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={!userToDelete || deleteNameConfirmation !== userToDelete.name}>
                            削除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
