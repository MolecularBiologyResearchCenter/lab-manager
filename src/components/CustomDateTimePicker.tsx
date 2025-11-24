'use client'

import { useState, forwardRef, useRef, useEffect } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ja } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'

registerLocale('ja', ja)

interface CustomDateTimePickerProps {
    selected: Date | null
    onChange: (date: Date | null) => void
    className?: string
}

const CustomInput = forwardRef<HTMLInputElement, any>(({ value, onClick, className }, ref) => (
    <Input
        value={value}
        onClick={onClick}
        readOnly
        ref={ref}
        className={className}
        placeholder="日時を選択"
    />
))

CustomInput.displayName = 'CustomInput'

export default function CustomDateTimePicker({ selected, onChange, className }: CustomDateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [tempDate, setTempDate] = useState<Date | null>(selected)
    const pickerRef = useRef<any>(null)

    useEffect(() => {
        if (isOpen) {
            setTempDate(selected)
        }
    }, [isOpen, selected])

    const handleDateChange = (date: Date | null) => {
        setTempDate(date)
    }

    const handleConfirm = () => {
        onChange(tempDate)
        setIsOpen(false)
    }

    const handleCancel = () => {
        setTempDate(selected)
        setIsOpen(false)
    }

    return (
        <div className={`relative w-full ${className || ''}`}>
            <DatePicker
                ref={pickerRef}
                selected={tempDate}
                onChange={handleDateChange}
                open={isOpen}
                onInputClick={() => setIsOpen(true)}
                customInput={<CustomInput className="text-lg pr-12 cursor-pointer w-full" />}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy/MM/dd HH:mm"
                locale="ja"
                timeCaption="時刻"
                popperPlacement="bottom-start"
                popperClassName="z-50"
                wrapperClassName="w-full"
                showIcon={false}
            />
            <div
                style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    zIndex: 10
                }}
            >
                <Calendar className="h-5 w-5" style={{ color: '#9CA3AF' }} />
            </div>
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                        e.stopPropagation()
                        handleCancel()
                    }}
                    style={{ backgroundColor: 'transparent' }}
                />
            )}
            {isOpen && (
                <div className="relative z-50">
                    <div className="absolute left-0 right-0 flex gap-2 p-3 border-t bg-white shadow-lg rounded-b-lg" style={{ marginTop: '-1px' }}>
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleCancel()
                            }}
                            variant="outline"
                            className="flex-1 text-lg py-5 border-2"
                            style={{ backgroundColor: '#FFE4E1', borderColor: '#FFB6C1' }}
                        >
                            キャンセル
                        </Button>
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleConfirm()
                            }}
                            className="flex-1 text-lg py-5"
                            style={{ backgroundColor: '#D4EDDA', color: '#155724', borderColor: '#C3E6CB' }}
                        >
                            入力
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
