import { prisma } from '@/lib/prisma'
import ReservationCalendar from '@/components/ReservationCalendar'
import { getCurrentUser, getEquipmentList } from '@/app/actions'
import { redirect } from 'next/navigation'

export default async function ReservationsPage() {
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
        phoneNumber: res.phoneNumber || undefined,
        userExtension: res.user.extension || undefined,
    }))

    return (
        <div className="content-wrapper py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">機器予約</h1>
                <p className="text-gray-600 mt-1">実験機器の予約・管理</p>
            </div>
            <ReservationCalendar
                reservations={events}
                equipmentList={equipmentList}
                currentUser={{
                    ...currentUser,
                    extension: currentUser.extension || undefined
                }}
            />
        </div>
    )
}
