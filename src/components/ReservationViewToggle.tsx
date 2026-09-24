'use client'

import Link from 'next/link'
import { List, Calendar } from 'lucide-react'
import { useUserLanguage } from '@/components/UserLanguageProvider'

interface Props {
    currentView: string
}

export default function ReservationViewToggle({ currentView }: Props) {
    const { t } = useUserLanguage()
    return (
        <div className="app-segmented mb-5">
            <Link
                href="/reservations?view=list"
                className={`app-segmented-item ${currentView === 'list' ? 'app-segmented-item-active' : ''}`}
            >
                <List className="h-4 w-4" />
                {t('equipmentList')}
            </Link>
            <Link
                href="/reservations?view=calendar"
                className={`app-segmented-item ${currentView === 'calendar' ? 'app-segmented-item-active' : ''}`}
            >
                <Calendar className="h-4 w-4" />
                {t('calendar')}
            </Link>
        </div>
    )
}
