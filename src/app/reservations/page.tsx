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
        <div className="content-wrapper py-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900">機器予約</h1>
                <p className="text-gray-600 mt-2 text-lg">実験機器の予約・管理</p>
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
