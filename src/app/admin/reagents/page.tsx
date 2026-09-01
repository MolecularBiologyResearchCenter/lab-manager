'use client'

import { useState, useEffect } from 'react'
import { getReagents, createReagent, updateReagent, deleteReagent } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

type Reagent = {
    id: string
    name: string
    unitPrice: number
}

export default function ReagentsPage() {
    const [reagents, setReagents] = useState<Reagent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [reagentToDelete, setReagentToDelete] = useState<string | null>(null)

    // Form states
    const [formName, setFormName] = useState('')
    const [formUnitPrice, setFormUnitPrice] = useState('')

    useEffect(() => {
        loadReagents()
    }, [])

    async function loadReagents() {
        setLoading(true)
        const result = await getReagents()
        if (result.success && result.reagents) {
            setReagents(result.reagents)
        } else {
            setError(result.error || 'Failed to load reagents')
        }
        setLoading(false)
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        const formData = new FormData()
        formData.append('name', formName)
        formData.append('unitPrice', formUnitPrice)

        const result = await createReagent(formData)
        if (result.success) {
            setFormName('')
            setFormUnitPrice('')
            setShowAddForm(false)
            loadReagents()
        } else {
            alert(result.error || '追加に失敗しました')
        }
    }

    async function handleUpdate(id: string) {
        const formData = new FormData()
        formData.append('name', formName)
        formData.append('unitPrice', formUnitPrice)

        const result = await updateReagent(id, formData)
        if (result.success) {
            setEditingId(null)
            setFormName('')
            setFormUnitPrice('')
            loadReagents()
        } else {
            alert(result.error || '更新に失敗しました')
        }
    }

    function openDeleteDialog(e: React.MouseEvent, id: string) {
        e.preventDefault()
        e.stopPropagation()
        setReagentToDelete(id)
        setDeleteDialogOpen(true)
    }

    async function confirmDelete() {
        if (!reagentToDelete) return

        const result = await deleteReagent(reagentToDelete)
        if (result.success) {
            loadReagents()
        } else {
            alert(result.error || '削除に失敗しました')
        }

        setDeleteDialogOpen(false)
        setReagentToDelete(null)
    }

    function cancelDelete() {
        setDeleteDialogOpen(false)
        setReagentToDelete(null)
    }

    function startEdit(reagent: Reagent) {
        setEditingId(reagent.id)
        setFormName(reagent.name)
        setFormUnitPrice(reagent.unitPrice.toString())
        setShowAddForm(false)
    }

    function cancelEdit() {
        setEditingId(null)
        setFormName('')
        setFormUnitPrice('')
    }

    function startAdd() {
        setShowAddForm(true)
        setEditingId(null)
        setFormName('')
        setFormUnitPrice('')
    }

    if (loading) {
        return <div className="content-wrapper py-8 text-sm text-slate-500">読み込み中...</div>
    }

    if (error) {
        return <div className="content-wrapper py-8 text-sm text-red-600">エラー: {error}</div>
    }

    return (
        <div className="content-wrapper space-y-6 py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1>有料サービス管理</h1>
                    <p className="mt-2 text-sm text-slate-500">サービス名と利用単価を管理します</p>
                </div>
                {!showAddForm && !editingId && (
                    <Button onClick={startAdd} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        新規追加
                    </Button>
                )}
            </div>

            {/* Add Form */}
            {showAddForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>新しい有料サービスを追加</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    サービス名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="例: シーケンサー3500xL"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    単価(円) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={formUnitPrice}
                                    onChange={(e) => setFormUnitPrice(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="例: 5600"
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" className="flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    追加
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowAddForm(false)}
                                    className="flex items-center gap-2"
                                >
                                    <X className="h-4 w-4" />
                                    キャンセル
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Reagents Table */}
            <Card>
                <CardHeader>
                    <CardTitle>有料サービス一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {reagents.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            登録されている有料サービスはありません
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>サービス名</TableHead>
                                    <TableHead className="text-right">単価(円)</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reagents.map((reagent, index) => (
                                    <TableRow key={reagent.id} style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                        {editingId === reagent.id ? (
                                            <>
                                                <TableCell>
                                                    <input
                                                        type="text"
                                                        value={formName}
                                                        onChange={(e) => setFormName(e.target.value)}
                                                        className="w-full px-2 py-1 border rounded"
                                                        required
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <input
                                                        type="number"
                                                        value={formUnitPrice}
                                                        onChange={(e) => setFormUnitPrice(e.target.value)}
                                                        className="w-full px-2 py-1 border rounded text-right"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleUpdate(reagent.id)}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                            保存
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={cancelEdit}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <X className="h-3 w-3" />
                                                            キャンセル
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell>{reagent.name}</TableCell>
                                                <TableCell className="text-right">
                                                    ¥{reagent.unitPrice.toLocaleString()}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => startEdit(reagent)}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                            編集
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={(e) => openDeleteDialog(e, reagent.id)}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                            削除
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white">
                    <DialogHeader>
                        <DialogTitle>削除の確認</DialogTitle>
                        <DialogDescription>
                            本当にこの有料サービスを削除しますか?この操作は取り消せません。
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
