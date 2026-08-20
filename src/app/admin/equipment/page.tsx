'use client'

import { useState, useEffect } from 'react'
import { getEquipment, getAvailableIcons, createEquipment, updateEquipment, deleteEquipment, uploadIcon } from './actions'
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
import { Pencil, Trash2, Plus, X, Check, Upload } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import Image from 'next/image'

type Equipment = {
    id: string
    name: string
    description: string | null
    icon: string | null
}

export default function EquipmentPage() {
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
    const [availableIcons, setAvailableIcons] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [equipmentToDelete, setEquipmentToDelete] = useState<string | null>(null)

    // Form states
    const [formName, setFormName] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formIcon, setFormIcon] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const [eqResult, iconResult] = await Promise.all([
            getEquipment(),
            getAvailableIcons()
        ])

        if (eqResult.success && eqResult.equipment) {
            setEquipmentList(eqResult.equipment)
        } else {
            setError(eqResult.error || 'Failed to load equipment')
        }

        if (iconResult.success && iconResult.icons) {
            setAvailableIcons(iconResult.icons)
        }

        setLoading(false)
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        console.log('Creating equipment:', { formName, formDescription, formIcon })

        const formData = new FormData()
        formData.append('name', formName)
        formData.append('description', formDescription)
        formData.append('icon', formIcon)

        const result = await createEquipment(formData)
        if (result.success) {
            resetForm()
            loadData()
        } else {
            console.error('Create failed:', result.error)
            alert(result.error || '追加に失敗しました')
        }
    }

    async function handleUpdate(id: string) {
        const formData = new FormData()
        formData.append('name', formName)
        formData.append('description', formDescription)
        formData.append('icon', formIcon)

        const result = await updateEquipment(id, formData)
        if (result.success) {
            setEditingId(null)
            resetForm()
            loadData()
        } else {
            alert(result.error || '更新に失敗しました')
        }
    }

    function openDeleteDialog(e: React.MouseEvent, id: string) {
        e.preventDefault()
        e.stopPropagation()
        setEquipmentToDelete(id)
        setDeleteDialogOpen(true)
    }

    async function confirmDelete() {
        if (!equipmentToDelete) return

        const result = await deleteEquipment(equipmentToDelete)
        if (result.success) {
            loadData()
        } else {
            alert(result.error || '削除に失敗しました')
        }

        setDeleteDialogOpen(false)
        setEquipmentToDelete(null)
    }

    function cancelDelete() {
        setDeleteDialogOpen(false)
        setEquipmentToDelete(null)
    }

    function startEdit(equipment: Equipment) {
        setEditingId(equipment.id)
        setFormName(equipment.name)
        setFormDescription(equipment.description || '')
        setFormIcon(equipment.icon || '')
        setShowAddForm(false)
    }

    function cancelEdit() {
        setEditingId(null)
        resetForm()
    }

    function startAdd() {
        setFormName('')
        setFormDescription('')
        setFormIcon('')
        setEditingId(null)
        setShowAddForm(true)
    }

    function resetForm() {
        console.log('Resetting form')
        setFormName('')
        setFormDescription('')
        setFormIcon('')
        setShowAddForm(false)
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        const result = await uploadIcon(formData)
        if (result.success && result.iconPath) {
            setAvailableIcons(prev => [...prev, result.iconPath!])
            setFormIcon(result.iconPath)
        } else {
            alert(result.error || 'アップロードに失敗しました')
        }
    }

    if (loading) {
        return <div className="content-wrapper py-8">読み込み中...</div>
    }

    if (error) {
        return <div className="content-wrapper py-8 text-red-600">エラー: {error}</div>
    }

    return (
        <div className="content-wrapper py-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-bold">機器管理</h1>
                {!showAddForm && !editingId && (
                    <Button onClick={startAdd} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        新規追加
                    </Button>
                )}
            </div>

            {/* Add/Edit Form */}
            {(showAddForm || editingId) && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editingId ? '機器を編集' : '新しい機器を追加'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    機器名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="name"
                                    name="name"
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
                                    説明(任意)
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="機器の説明を入力してください"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">
                                        アイコン選択
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="icon-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => document.getElementById('icon-upload')?.click()}
                                            className="flex items-center gap-1"
                                        >
                                            <Upload className="h-3 w-3" />
                                            アイコンを追加
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-2 border p-4 rounded-md max-h-60 overflow-y-auto">
                                    {availableIcons.map((iconPath) => (
                                        <div
                                            key={iconPath}
                                            onClick={() => setFormIcon(iconPath)}
                                            className={`cursor-pointer p-1 border-2 rounded-md hover:bg-gray-50 flex items-center justify-center aspect-square ${formIcon === iconPath ? 'border-blue-500 bg-blue-50' : 'border-transparent'
                                                }`}
                                        >
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={iconPath}
                                                    alt="icon"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {formIcon && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        選択中: {formIcon.split('/').pop()}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" className="flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    {editingId ? '保存' : '追加'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={editingId ? cancelEdit : resetForm}
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

            {/* Equipment Table */}
            <Card>
                <CardHeader>
                    <CardTitle>機器一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {equipmentList.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            登録されている機器はありません
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">アイコン</TableHead>
                                    <TableHead>機器名</TableHead>
                                    <TableHead>説明</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {equipmentList.map((equipment, index) => (
                                    <TableRow key={equipment.id} style={index % 2 === 1 ? { backgroundColor: '#f3f4f6' } : {}}>
                                        <TableCell>
                                            {equipment.icon ? (
                                                <div className="relative w-10 h-10">
                                                    <Image
                                                        src={equipment.icon}
                                                        alt={equipment.name}
                                                        fill
                                                        className="object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                                                    No
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{equipment.name}</TableCell>
                                        <TableCell className="text-gray-500 truncate max-w-[200px]">
                                            {equipment.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-1 justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => startEdit(equipment)}
                                                    className="flex items-center gap-1"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                    編集
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={(e) => openDeleteDialog(e, equipment.id)}
                                                    className="flex items-center gap-1"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                    削除
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent style={{ maxWidth: '400px', border: '2px solid #3b82f6', backgroundColor: '#ffffff' }}>
                    <DialogHeader>
                        <DialogTitle>削除の確認</DialogTitle>
                        <DialogDescription>
                            本当にこの機器を削除しますか?この操作は取り消せません。
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
