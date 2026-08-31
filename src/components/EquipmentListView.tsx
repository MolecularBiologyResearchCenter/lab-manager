'use client'
// Last updated: 2025-11-25 09:34

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import CustomDateTimePicker from '@/components/CustomDateTimePicker'
import { createReservation } from '@/app/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Equipment {
    id: string
    name: string
    description?: string | null
    icon?: string | null
}

interface Reservation {
    id: string
    equipmentId: string
    startTime: Date
    endTime: Date
}

interface User {
    id: string
    name: string
    extension?: string
}

interface EquipmentListViewProps {
    equipmentList: Equipment[]
    currentUser: User
    reservations: any[]
}

export default function EquipmentListView({ equipmentList, currentUser, reservations }: EquipmentListViewProps) {
    const router = useRouter()
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [startTime, setStartTime] = useState<Date | null>(null)
    const [endTime, setEndTime] = useState<Date | null>(null)
    const [phoneNumber, setPhoneNumber] = useState<string>('')

    const handleOpenDialog = (equipmentId: string) => {
        setSelectedEquipment(equipmentId)
        // Set default times: now to 1 hour from now
        const now = new Date()
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
        setStartTime(now)
        setEndTime(oneHourLater)
        setPhoneNumber(currentUser.extension || '')
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedEquipment || !startTime || !endTime) {
            toast.error('全ての項目を入力してください。')
            return
        }

        try {
            await createReservation(selectedEquipment, currentUser.id, startTime, endTime, phoneNumber)
            toast.success('予約が完了しました!')
            setIsDialogOpen(false)
            setTimeout(() => {
                router.refresh()
            }, 2000)
        } catch (error) {
            console.error('Error:', error)
            toast.error('予約に失敗しました: ' + (error as Error).message)
        }
    }

    const isEquipmentAvailable = (equipmentId: string) => {
        const now = new Date()
        const equipmentReservations = reservations.filter(r => r.equipmentId === equipmentId)

        return !equipmentReservations.some(r => {
            const start = new Date(r.startTime)
            const end = new Date(r.endTime)
            return now >= start && now <= end
        })
    }

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {equipmentList.map((equipment) => {
                    // Use icon from database, or fallback to default
                    const imagePath = equipment.icon || '/icons-blue/3500xL.jpg'

                    const isAvailable = isEquipmentAvailable(equipment.id)

                    return (
                        <div
                            key={equipment.id}
                            className="app-surface flex min-w-0 flex-col justify-between p-3 transition-shadow hover:shadow-md md:p-4"
                        >
                            <div>
                                {/* Left: Icon */}
                                <div className="mb-3 grid h-16 place-items-center rounded-xl bg-slate-50 md:h-20">
                                    <img
                                        src={imagePath}
                                        alt={equipment.name}
                                        className="h-14 w-14 object-contain mix-blend-multiply md:h-16 md:w-16"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <h3 className="w-full truncate text-sm font-semibold leading-tight text-slate-800 md:text-base">
                                        {equipment.name}
                                    </h3>

                                    <div className="mt-2 flex min-h-5 items-center">
                                        {isAvailable ? (
                                            <div className="flex items-center whitespace-nowrap text-xs font-medium text-slate-600">
                                                <div
                                                    className="rounded-full"
                                                    style={{ width: '16px', height: '16px', minWidth: '16px', marginRight: '0.7rem', backgroundColor: '#22c55e' }}
                                                ></div>
                                                利用可能
                                            </div>
                                        ) : (
                                            <div className="flex items-center whitespace-nowrap text-xs font-medium text-slate-600">
                                                <div
                                                    className="rounded-full"
                                                    style={{ width: '16px', height: '16px', minWidth: '16px', marginRight: '0.7rem', backgroundColor: '#ef4444' }}
                                                ></div>
                                                使用中
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Reserve Button - Bottom */}
                            <div className="mt-4">
                                <Button
                                    onClick={() => handleOpenDialog(equipment.id)}
                                    className="h-10 w-full rounded-xl bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800"
                                >
                                    予約
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <DialogHeader>
                        <DialogTitle>新規予約</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>予約者</Label>
                            <div className="p-2 bg-gray-50 rounded border border-gray-200 text-gray-700">
                                {currentUser.name}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>機器</Label>
                            <Select onValueChange={setSelectedEquipment} value={selectedEquipment || undefined} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="機器を選択" />
                                </SelectTrigger>
                                <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false} style={{ maxHeight: '400px', backgroundColor: 'white' }}>
                                    {equipmentList.map((eq) => (
                                        <SelectItem key={eq.id} value={eq.id} style={{ padding: '0.625rem 0.75rem', minHeight: '40px', display: 'flex', alignItems: 'center' }}>
                                            {eq.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label className="text-base">開始日時</Label>
                                <input
                                    type="datetime-local"
                                    value={startTime ? new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => setStartTime(e.target.value ? new Date(e.target.value) : null)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    style={{ fontSize: '1rem', height: '2.5rem' }}
                                    required
                                />
                            </div>
                            <div>
                                <Label className="text-base">終了日時</Label>
                                <input
                                    type="datetime-local"
                                    value={endTime ? new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => setEndTime(e.target.value ? new Date(e.target.value) : null)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    style={{ fontSize: '1rem', height: '2.5rem' }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button type="submit" className="h-11 flex-1 rounded-xl bg-blue-700 font-semibold text-white hover:bg-blue-800">
                                予約する
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
