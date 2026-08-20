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
            <div className="flex flex-col items-center mb-8">
                <h2 className="text-3xl font-bold text-blue-900">機器予約</h2>
                <div className="h-1 w-16 bg-blue-600 mt-2"></div>
            </div>

            {/* Custom CSS for Grid Layout */}
            <style jsx global>{`
                .equipment-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                }
                @media (min-width: 768px) {
                    .equipment-grid {
                        grid-template-columns: repeat(4, 1fr);
                        gap: 1.5rem;
                    }
                }
            `}</style>

            {/* Grid Layout using custom class */}
            <div className="equipment-grid">
                {equipmentList.map((equipment) => {
                    // Use icon from database, or fallback to default
                    const imagePath = equipment.icon || '/icons-blue/3500xL.jpg'

                    const isAvailable = isEquipmentAvailable(equipment.id)

                    return (
                        <div
                            key={equipment.id}
                            className="p-3 shadow-sm flex flex-col justify-between"
                            style={{
                                backgroundColor: 'white',
                                border: '2px solid #2563eb',
                                borderRadius: '12px'
                            }}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                {/* Left: Icon */}
                                <div className="flex-shrink-0 relative" style={{ width: '60px', height: '60px' }}>
                                    <img
                                        src={imagePath}
                                        alt={equipment.name}
                                        className="object-contain w-full h-full"
                                    />
                                </div>

                                {/* Right: Name & Status */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center items-center">
                                    <h3 className="text-base font-bold text-gray-900 leading-tight truncate text-center w-full">
                                        {equipment.name}
                                    </h3>

                                    {/* Status - Below Name */}
                                    <div className="flex items-center justify-center mt-1 w-full">
                                        {isAvailable ? (
                                            <div className="flex items-center text-[0.7rem] font-medium text-gray-600 whitespace-nowrap">
                                                <div
                                                    className="rounded-full mr-1"
                                                    style={{ width: '8px', height: '8px', minWidth: '8px', backgroundColor: '#22c55e' }}
                                                ></div>
                                                利用可能
                                            </div>
                                        ) : (
                                            <div className="flex items-center text-[0.7rem] font-medium text-gray-600 whitespace-nowrap">
                                                <div
                                                    className="rounded-full mr-1"
                                                    style={{ width: '8px', height: '8px', minWidth: '8px', backgroundColor: '#ef4444' }}
                                                ></div>
                                                使用中
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Reserve Button - Bottom */}
                            <div>
                                <Button
                                    onClick={() => handleOpenDialog(equipment.id)}
                                    className="w-full text-white font-bold h-12 hover:shadow-lg hover:scale-105 transition-all duration-200"
                                    style={{
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        borderRadius: '8px',
                                        height: '3rem',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    予約
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md bg-white" style={{ maxWidth: '280px', backgroundColor: '#eff6ff', border: '2px solid #2563eb', borderRadius: '12px' }}>
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
                            <Button type="submit" className="flex-1 font-bold" style={{ backgroundColor: '#2563eb', color: 'white', padding: '1.5rem', fontSize: '1.5rem' }}>
                                予約する
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
