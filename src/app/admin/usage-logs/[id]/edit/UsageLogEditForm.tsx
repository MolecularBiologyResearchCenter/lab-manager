'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { updateUsageLog } from '../../actions'

export default function UsageLogEditForm({
    log,
}: {
    log: {
        id: string
        quantity: number
        totalCost: number
        user: { name: string }
        reagent: { name: string; unitPrice: number }
        date: Date
    }
}) {
    const [quantity, setQuantity] = useState(log.quantity)
    const [totalCost, setTotalCost] = useState(log.totalCost)

    const handleQuantityChange = (newQuantity: number) => {
        setQuantity(newQuantity)
        setTotalCost(newQuantity * log.reagent.unitPrice)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await updateUsageLog(log.id, quantity, totalCost)
    }

    return (
        <div className="content-wrapper py-8">
            <div className="mb-6">
                <Link href="/admin/usage-logs">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        利用料金管理に戻る
                    </Button>
                </Link>
            </div>

            <Card className="card-elevated max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>利用料金の編集</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label>日付</Label>
                            <p className="text-sm text-gray-600">
                                {new Date(log.date).toLocaleDateString('ja-JP')}
                            </p>
                        </div>

                        <div>
                            <Label>利用者</Label>
                            <p className="text-sm text-gray-600">{log.user.name}</p>
                        </div>

                        <div>
                            <Label>試薬名</Label>
                            <p className="text-sm text-gray-600">{log.reagent.name}</p>
                        </div>

                        <div>
                            <Label>単価</Label>
                            <p className="text-sm text-gray-600">
                                ¥{log.reagent.unitPrice.toLocaleString()}
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="quantity">数量</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="totalCost">合計金額</Label>
                            <Input
                                id="totalCost"
                                type="number"
                                min="0"
                                value={totalCost}
                                onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                自動計算: ¥{(quantity * log.reagent.unitPrice).toLocaleString()}
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <Button type="submit" className="btn-primary">
                                保存
                            </Button>
                            <Link href="/admin/usage-logs">
                                <Button type="button" variant="outline">
                                    キャンセル
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
