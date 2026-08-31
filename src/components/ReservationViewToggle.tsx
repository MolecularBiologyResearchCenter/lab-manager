'use client'

import Link from 'next/link'
import { List, Calendar } from 'lucide-react'

interface Props {
    currentView: string
}

export default function ReservationViewToggle({ currentView }: Props) {
    return (
        <div className="app-segmented mb-5">
            <Link
                href="/reservations?view=list"
                className={`app-segmented-item ${currentView === 'list' ? 'app-segmented-item-active' : ''}`}
            >
                <List className="h-4 w-4" />
                一覧
            </Link>
            <Link
                href="/reservations?view=calendar"
                className={`app-segmented-item ${currentView === 'calendar' ? 'app-segmented-item-active' : ''}`}
            >
                <Calendar className="h-4 w-4" />
                カレンダー
            </Link>
        </div>
    )
}
