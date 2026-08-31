'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logReagentUsage } from '@/app/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Reagent {
    id: string
    name: string
    unitPrice: number
    stock: number | null
}

interface User {
    id: string
    name: string
    role: string
}

interface Props {
    reagents: Reagent[]
    currentUser: User
}

export default function ReagentLogger({ reagents, currentUser }: Props) {
    const [selectedReagent, setSelectedReagent] = useState<string>('')
    const [quantity, setQuantity] = useState<number>(1)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedReagent) return

        try {
            await logReagentUsage(currentUser.id, selectedReagent, quantity)
            toast.success('記録しました')
            router.refresh()
            // Reset form
            setQuantity(1)
            setSelectedReagent('')
        } catch (error) {
            toast.error('記録に失敗しました: ' + (error as Error).message)
        }
    }

    const currentReagent = reagents.find(r => r.id === selectedReagent)

    return (
        <section className="app-surface mx-auto max-w-lg overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                <h2 className="font-semibold text-slate-800">新しい利用記録</h2>
                <p className="mt-1 text-xs text-slate-500">利用者：{currentUser.name}</p>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="space-y-5 px-5 py-5 md:px-6">
                    <div className="space-y-2">
                        <Label className="app-label">サービス・試薬</Label>
                        <Select onValueChange={setSelectedReagent} value={selectedReagent} required>
                            <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white text-base">
                                <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false} className="max-h-[400px] bg-white">
                                {reagents.map((r) => (
                                    <SelectItem key={r.id} value={r.id} className="min-h-10 px-3 py-2 text-base">
                                        {r.name} (¥{r.unitPrice})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="app-label">数量</Label>
                        <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                            required
                            className="h-11 w-full rounded-xl border-slate-300 bg-white text-base"
                        />
                        {currentReagent && (
                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                                <span className="text-sm text-slate-500">合計</span>
                                <strong className="text-xl font-semibold text-slate-800">¥{(currentReagent.unitPrice * quantity).toLocaleString()}</strong>
                            </div>
                        )}
                    </div>
                    <Button type="submit" className="h-12 w-full rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800">記録する</Button>
                </div>
            </form>
        </section>
    )
}
