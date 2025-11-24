'use client'

import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createReservation, updateReservation, deleteReservation } from '@/app/actions'
import CustomDateTimePicker from '@/components/CustomDateTimePicker'
import { useRouter } from 'next/navigation'

const locales = {
    'ja': ja,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})

interface Equipment {
    id: string
    name: string
}

interface User {
    id: string
    name: string
    role: string
    extension?: string
}

interface Reservation {
    id: string
    title: string
    start: Date
    end: Date
    resourceId: string
    phoneNumber?: string
    userExtension?: string
    userId: string
    userName?: string
}

interface Props {
    reservations: Reservation[]
    equipmentList: Equipment[]
    currentUser: User
}

export default function ReservationCalendar({ reservations, equipmentList, currentUser }: Props) {
    const router = useRouter()
    const [view, setView] = useState<View>('week')
    const [date, setDate] = useState(new Date())
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
    const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)

    // Form state
    const [selectedEquipment, setSelectedEquipment] = useState<string>('')
    const [showActiveOnly, setShowActiveOnly] = useState(false)
    const [visibleEquipmentIds, setVisibleEquipmentIds] = useState<string[]>([])
    const [phoneNumber, setPhoneNumber] = useState<string>('')

    // Initialize visible equipment
    useEffect(() => {
        if (equipmentList.length > 0 && visibleEquipmentIds.length === 0) {
            setVisibleEquipmentIds(equipmentList.map(e => e.id))
        }
    }, [equipmentList])

    const toggleEquipment = (id: string) => {
        setVisibleEquipmentIds(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        )
    }

    const toggleAllEquipment = () => {
        if (visibleEquipmentIds.length === equipmentList.length) {
            setVisibleEquipmentIds([])
        } else {
            setVisibleEquipmentIds(equipmentList.map(e => e.id))
        }
    }

    // Date inputs (Date objects for custom picker)
    const [startTime, setStartTime] = useState<Date | null>(null)
    const [endTime, setEndTime] = useState<Date | null>(null)

    const filteredReservations = reservations.filter(res => {
        // Filter by equipment visibility
        if (!visibleEquipmentIds.includes(res.resourceId)) return false

        // Filter by active status if enabled
        if (showActiveOnly) {
            const now = new Date()
            return res.start <= now && res.end >= now
        }
        return true
    })

    const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
        setEditingReservation(null)
        setSelectedSlot(slotInfo)
        setStartTime(slotInfo.start)
        setEndTime(slotInfo.end)
        setSelectedEquipment('')
        // Auto-fill phone number from current user
        setPhoneNumber(currentUser.extension || '')
        setIsDialogOpen(true)
    }

    const handleSelectEvent = (event: Reservation) => {
        setEditingReservation(event)
        setStartTime(event.start)
        setEndTime(event.end)
        setSelectedEquipment(event.resourceId)
        setPhoneNumber(event.phoneNumber || '')
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedEquipment || !startTime || !endTime) {
            toast.error('全ての項目を入力してください。')
            return
        }

        try {
            if (editingReservation) {
                // Permission check
                const isAdminUser = currentUser.role === 'ADMIN'
                const isOriginalOwner = currentUser.id === editingReservation.userId

                if (!isOriginalOwner && !isAdminUser) {
                    toast.error('予約の編集・削除は本人または管理者のみ可能です。')
                    return
                }

                await updateReservation(editingReservation.id, selectedEquipment, editingReservation.userId, startTime, endTime, phoneNumber)
                toast.success('予約を更新しました！')
            } else {
                await createReservation(selectedEquipment, currentUser.id, startTime, endTime, phoneNumber)
                toast.success('予約が完了しました！')
            }
            setIsDialogOpen(false)
            // Refresh data to reflect changes
            setTimeout(() => {
                router.refresh()
            }, 2000)
        } catch (error) {
            console.error('Error:', error)
            toast.error('操作に失敗しました: ' + (error as Error).message)
        }
    }


    // Pastel Rainbow Colors
    const EQUIPMENT_COLORS = [
        '#FFB3BA', // Red
        '#FFDFBA', // Orange
        '#FFFFBA', // Yellow
        '#BAFFC9', // Green
        '#BAE1FF', // Blue
        '#E6B3FF', // Purple
        '#FFC3A0', // Peach
        '#D5AAFF', // Lavender
        '#B5EAD7', // Mint
        '#C7CEEA', // Periwinkle
    ]

    const getEquipmentColor = (equipmentId: string) => {
        const equipment = equipmentList.find(e => e.id === equipmentId)
        if (!equipment) return '#E2E8F0' // Default gray

        const name = equipment.name
        // Distinct colors for better visibility
        if (name.includes('MiSeq')) return '#85C1E9' // Lighter Blue
        if (name.includes('iD5')) return '#FFB347' // Orange
        if (name.includes('NepaGene')) return '#D2B4DE' // Lighter Purple
        if (name.includes('IQ800')) return '#FFB7B2' // Pastel Pink (Swapped with CFX Duet)
        if (name.includes('FUSION')) return '#FF69B4' // Hot Pink
        if (name.includes('3500xL')) return '#1ABC9C' // Turquoise
        if (name.includes('QX-200')) return '#EC7063' // Intermediate Red
        if (name.includes('TapeStation')) return '#FFF176' // Yellow
        if (name.includes('Qubit')) return '#9575CD' // Deep Lavender
        if (name.includes('ECLIPS')) return '#B0C4DE' // Light Steel Blue
        if (name.includes('安キャビ')) return '#D7DBDD' // Light Gray
        if (name.includes('CFX Duet')) return '#AED581' // Yellowish Green (Swapped with IQ800)
        if (name.includes('CFX96')) return '#B5EAD7' // Pastel Green

        // Fallback using the index in the list to pick from EQUIPMENT_COLORS
        const index = equipmentList.findIndex(e => e.id === equipmentId)
        return EQUIPMENT_COLORS[index % EQUIPMENT_COLORS.length]
    }

    const eventPropGetter = (event: Reservation) => {
        const backgroundColor = getEquipmentColor(event.resourceId)
        return {
            style: {
                backgroundColor,
                color: '#333', // Dark text for better contrast on pastel backgrounds
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '4px',
                display: 'block',
                fontSize: '0.85em', // Smaller font size
                lineHeight: '1.2'
            }
        }
    }

    const handleDelete = async () => {
        if (!editingReservation) return

        const isAdminUser = currentUser.role === 'ADMIN'
        const isOriginalOwner = currentUser.id === editingReservation.userId

        if (!isOriginalOwner && !isAdminUser) {
            toast.error('予約の削除は本人または管理者のみ可能です。')
            return
        }

        if (!confirm('本当にこの予約を削除しますか？')) return

        try {
            await deleteReservation(editingReservation.id)
            setIsDialogOpen(false)
            toast.success('予約を削除しました。')
            // Refresh data to reflect changes
            setTimeout(() => {
                router.refresh()
            }, 2000)
        } catch (error) {
            toast.error('削除に失敗しました: ' + (error as Error).message)
        }
    }

    const CustomEvent = ({ event }: { event: Reservation }) => {
        return (
            <div className="text-xs leading-tight">
                <div className="font-semibold">{event.title.split('(')[0]}</div>
                <div>
                    {event.title.split('(')[1]?.split(')')[0]}
                </div>
                {event.phoneNumber && (
                    <div className="flex items-center gap-1 mt-0.5 text-[0.9em] opacity-90">
                        <span className="text-[0.8em]">📞</span>
                        <span>{event.phoneNumber}</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-row gap-4">
            {/* Sidebar for Equipment Filtering */}
            <div className="w-64 flex-shrink-0 bg-white p-4 rounded-lg shadow overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700">表示機器</h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllEquipment}
                        className="text-xs text-blue-600 hover:text-blue-800"
                    >
                        {visibleEquipmentIds.length === equipmentList.length ? '全解除' : '全選択'}
                    </Button>
                </div>
                <div className="space-y-2">
                    {equipmentList.map(eq => (
                        <div key={eq.id} className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id={`eq-${eq.id}`}
                                checked={visibleEquipmentIds.includes(eq.id)}
                                onChange={() => toggleEquipment(eq.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                                htmlFor={`eq-${eq.id}`}
                                className="text-sm text-gray-700 cursor-pointer flex-1 truncate"
                                title={eq.name}
                            >
                                {eq.name}
                            </label>
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getEquipmentColor(eq.id) }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4 px-4">
                    <div className="flex gap-2">
                        <Button
                            variant={view === 'month' ? 'default' : 'outline'}
                            onClick={() => setView('month')}
                        >
                            月
                        </Button>
                        <Button
                            variant={view === 'week' ? 'default' : 'outline'}
                            onClick={() => setView('week')}
                        >
                            週
                        </Button>
                        <Button
                            variant={view === 'day' ? 'default' : 'outline'}
                            onClick={() => setView('day')}
                        >
                            日
                        </Button>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={() => setDate(new Date())}>
                            今日
                        </Button>
                        <span className="text-lg font-bold">
                            {date.getFullYear()}年 {date.getMonth() + 1}月
                        </span>
                    </div>
                </div>

                <div className="flex-1 px-4 pb-4">
                    <Calendar
                        localizer={localizer}
                        events={filteredReservations}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: 'calc(100vh - 150px)', backgroundColor: 'white' }}
                        view={view}
                        onView={setView}
                        date={date}
                        onNavigate={setDate}
                        selectable
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventPropGetter}
                        components={{
                            event: CustomEvent
                        }}
                        messages={{
                            next: "次へ",
                            previous: "前へ",
                            today: "今日",
                            month: "月",
                            week: "週",
                            day: "日",
                            date: "日付",
                            time: "時間",
                            event: "イベント",
                            noEventsInRange: "この期間に予約はありません。",
                        }}
                        formats={{
                            timeGutterFormat: (date: Date, culture?: string, localizer?: any) =>
                                localizer.format(date, 'HH:mm', culture),
                        }}
                        tooltipAccessor={(event: Reservation) => {
                            return `${event.title}${event.phoneNumber ? ` Tel: ${event.phoneNumber}` : ''}`
                        }}
                    />
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md bg-white" style={{ maxWidth: '448px', backgroundColor: 'white' }}>
                    <DialogHeader>
                        <DialogTitle>{editingReservation ? '予約の編集' : '新規予約'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>予約者</Label>
                            <div className="p-2 bg-gray-50 rounded border border-gray-200 text-gray-700">
                                {editingReservation ? editingReservation.userName || '不明' : currentUser.name}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>機器</Label>
                            <Select onValueChange={setSelectedEquipment} value={selectedEquipment} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="機器を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    {equipmentList.map((eq) => (
                                        <SelectItem key={eq.id} value={eq.id}>
                                            {eq.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-base">開始日時</Label>
                                <CustomDateTimePicker
                                    selected={startTime}
                                    onChange={setStartTime}
                                />
                            </div>
                            <div>
                                <Label className="text-base">終了日時</Label>
                                <CustomDateTimePicker
                                    selected={endTime}
                                    onChange={setEndTime}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button type="submit" className="flex-1 text-lg py-6">
                                {editingReservation ? '更新する' : '予約する'}
                            </Button>
                            {editingReservation && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="flex-1 text-lg py-6"
                                    onClick={handleDelete}
                                >
                                    削除する
                                </Button>
                            )}
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
