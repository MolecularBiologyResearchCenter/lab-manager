import { prisma } from '@/lib/prisma'
import ReservationCalendar from '@/components/ReservationCalendar'
import EquipmentListView from '@/components/EquipmentListView'
import { getCurrentUser, getEquipmentList } from '@/app/actions'
import { redirect } from 'next/navigation'
import ReservationViewToggle from '@/components/ReservationViewToggle'

export default async function ReservationsPage(props: { searchParams: Promise<{ view?: string }> }) {
    const searchParams = await props.searchParams
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        redirect('/login')
    }

    const reservations = await prisma.reservation.findMany({
        include: {
            equipment: true,
            user: true,
        },
    })

    const equipmentList = await getEquipmentList()

    const events = reservations.map(res => ({
        id: res.id,
        title: `${res.equipment.name} (${res.user.name})`,
        start: res.startTime,
        end: res.endTime,
        resourceId: res.equipmentId,
        userId: res.userId,
        userName: res.user.name, // Pass user name for display
        userLaboratory: res.user.laboratory || undefined,
        phoneNumber: res.phoneNumber || undefined,
        userExtension: res.user.extension || undefined,
    }))

    // Get view preference from URL params, default to 'list'
    const view = searchParams.view || 'list'

    return (
        <div className="content-wrapper app-page">
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">機器予約</h1>
                    <p className="app-page-description">機器を選んで空き状況を確認</p>
                </div>
            </div>

            <ReservationViewToggle currentView={view} />

            {view === 'list' ? (
                <EquipmentListView
                    equipmentList={equipmentList}
                    currentUser={{
                        ...currentUser,
                        extension: currentUser.extension || undefined
                    }}
                    reservations={reservations}
                />
            ) : (
                <ReservationCalendar
                    reservations={events}
                    equipmentList={equipmentList}
                    currentUser={{
                        ...currentUser,
                        extension: currentUser.extension || undefined
                    }}
                />
            )}
        </div>
    )
}
