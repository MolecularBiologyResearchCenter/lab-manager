'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
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
        <Card className="w-[400px] mx-auto mt-10" style={{ backgroundColor: 'white' }}>
            <CardHeader>
                <CardTitle>有料サービス記録</CardTitle>
                <CardDescription>
                    利用者: {currentUser.name}
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>サービス・試薬</Label>
                        <Select onValueChange={setSelectedReagent} value={selectedReagent} required>
                            <SelectTrigger style={{ backgroundColor: 'white' }}>
                                <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent style={{ backgroundColor: 'white' }}>
                                {reagents.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.name} (¥{r.unitPrice})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>数量</Label>
                        <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                            required
                            style={{ backgroundColor: 'white' }}
                        />
                        {currentReagent && (
                            <p className="text-sm text-muted-foreground text-right">
                                合計: ¥{(currentReagent.unitPrice * quantity).toLocaleString()}
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full">記録する</Button>
                </CardFooter>
            </form>
        </Card>
    )
}
