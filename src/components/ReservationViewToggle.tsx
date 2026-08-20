'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { List, Calendar } from 'lucide-react'

interface Props {
    currentView: string
}

export default function ReservationViewToggle({ currentView }: Props) {
    return (
        <div className="flex gap-3 mb-6">
            <Link href="/reservations?view=list">
                <Button
                    variant={currentView === 'list' ? 'default' : 'outline'}
                    size="lg"
                    className="text-lg py-6 px-6"
                >
                    <List className="h-5 w-5 mr-2" />
                    リスト表示
                </Button>
            </Link>
            <Link href="/reservations?view=calendar">
                <Button
                    variant={currentView === 'calendar' ? 'default' : 'outline'}
                    size="lg"
                    className="text-lg py-6 px-6"
                >
                    <Calendar className="h-5 w-5 mr-2" />
                    カレンダー表示
                </Button>
            </Link>
        </div>
    )
}
