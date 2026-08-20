'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface Props {
    currentYear: number
}

export default function AdminYearSelect({ currentYear }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Determine selected year from URL or default to current year
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')

    let selectedYear = currentYear.toString()
    if (yearParam) {
        selectedYear = yearParam
    } else if (monthParam) {
        const [y] = monthParam.split('-')
        if (y) selectedYear = y
    }

    const handleValueChange = (val: string) => {
        // Navigate to the selected year
        // We clear the month param to let the page decide the default month (e.g., Jan)
        router.push(`/admin?year=${val}`)
    }

    // Generate a list of years (e.g., current year + past 4 years)
    const years = []
    for (let i = 0; i < 5; i++) {
        years.push(currentYear - i)
    }

    return (
        <Select value={selectedYear} onValueChange={handleValueChange}>
            <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="年選択" />
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={5} align="start" avoidCollisions={false}>
                {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                        {y}年
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
