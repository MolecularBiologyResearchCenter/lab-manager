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
import { ArrowLeft, Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { deleteUser, updateUserRole } from '@/app/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil } from 'lucide-react'

interface User {
    id: string
    name: string
    email: string
    employeeId: string
    role: string
    department: string | null
    laboratory: string | null
    extension: string | null
    createdAt: Date
}

export default function UsersPage() {
    const router = useRouter()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null)

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [userToEdit, setUserToEdit] = useState<User | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>('USER')

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users')
            const data = await response.json()
            setUsers(data)
        } catch (error) {
            console.error('Failed to fetch users:', error)
        } finally {
            setLoading(false)
        }
    }

    const openDeleteDialog = (e: React.MouseEvent, userId: string, userName: string) => {
        e.preventDefault()
        e.stopPropagation()
        setUserToDelete({ id: userId, name: userName })
        setDeleteDialogOpen(true)
    }

    const openEditDialog = (e: React.MouseEvent, user: User) => {
        e.preventDefault()
        e.stopPropagation()
        setUserToEdit(user)
        setSelectedRole(user.role)
        setEditDialogOpen(true)
    }

    const confirmDelete = async () => {
        if (!userToDelete) return

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
    }

    const confirmUpdate = async () => {
        if (!userToEdit) return

        try {
            await updateUserRole(userToEdit.id, selectedRole)
            toast.success('権限を更新しました')
            router.refresh()
            fetchUsers()
        } catch (error) {
            toast.error('更新に失敗しました: ' + (error as Error).message)
        }

        setEditDialogOpen(false)
        setUserToEdit(null)
    }

    const cancelDelete = () => {
        setDeleteDialogOpen(false)
        setUserToDelete(null)
    }

    const cancelEdit = () => {
        setEditDialogOpen(false)
        setUserToEdit(null)
    }

    if (loading) {
        return (
            <div className="content-wrapper py-8 space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">利用者一覧</h1>
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
        <div className="content-wrapper py-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold">利用者一覧</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>登録ユーザー ({users.length}名)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>名前</TableHead>
                                    <TableHead>メールアドレス</TableHead>
                                    <TableHead>職員番号</TableHead>
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
                                        <TableCell>{user.employeeId}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                                                    user.role === 'CENTER_DIRECTOR' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-blue-100 text-blue-800'
                                                }`}>
                                                {user.role}
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
                                                    onClick={(e) => openDeleteDialog(e, user.id, user.name)}
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
                <DialogContent style={{ maxWidth: '400px', border: '2px solid #3b82f6', backgroundColor: '#ffffff' }}>
                    <DialogHeader>
                        <DialogTitle>権限の変更</DialogTitle>
                        <DialogDescription>
                            {userToEdit?.name} さんの権限を変更します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="role">権限</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="権限を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USER">USER (一般)</SelectItem>
                                    <SelectItem value="CENTER_DIRECTOR">CENTER_DIRECTOR (センター長)</SelectItem>
                                    <SelectItem value="ADMIN">ADMIN (管理者)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelEdit}>
                            キャンセル
                        </Button>
                        <Button onClick={confirmUpdate} className="bg-blue-600 text-white hover:bg-blue-700">
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent style={{ maxWidth: '400px', border: '2px solid #3b82f6', backgroundColor: '#ffffff' }}>
                    <DialogHeader>
                        <DialogTitle>削除の確認</DialogTitle>
                        <DialogDescription>
                            本当に {userToDelete?.name} さんを削除しますか？この操作は取り消せません。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDelete}>
                            キャンセル
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            削除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
