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
        <Card className="mx-auto mt-10" style={{ maxWidth: '280px', backgroundColor: '#eff6ff', border: '2px solid #2563eb', borderRadius: '12px' }}>
            <CardHeader style={{ paddingBottom: '1.5rem' }}>
                <CardTitle style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>有料サービス記録</CardTitle>
                <CardDescription style={{ fontSize: '1rem' }}>
                    利用者: {currentUser.name}
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="flex flex-col" style={{ gap: '2rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <div className="space-y-4">
                        <Label className="text-base" style={{ display: 'block', marginTop: '1rem' }}>サービス・試薬</Label>
                        <Select onValueChange={setSelectedReagent} value={selectedReagent} required>
                            <SelectTrigger style={{ backgroundColor: 'white', height: '3.5rem', fontSize: '1.1rem' }}>
                                <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false} style={{ backgroundColor: 'white', maxHeight: '400px' }}>
                                {reagents.map((r) => (
                                    <SelectItem key={r.id} value={r.id} className="text-base" style={{ padding: '0.625rem 0.75rem', minHeight: '40px', display: 'flex', alignItems: 'center' }}>
                                        {r.name} (¥{r.unitPrice})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-base">数量</Label>
                        <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                            required
                            style={{ backgroundColor: 'white', fontSize: '1.1rem', height: '3.5rem', width: '100%' }}
                        />
                        {currentReagent && (
                            <p className="text-sm text-muted-foreground text-right">
                                合計: ¥{(currentReagent.unitPrice * quantity).toLocaleString()}
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full font-bold" style={{ backgroundColor: '#2563eb', color: 'white', padding: '1.5rem', fontSize: '1.5rem', borderRadius: '12px' }}>記録する</Button>
                </CardFooter>
            </form>
        </Card>
    )
}
