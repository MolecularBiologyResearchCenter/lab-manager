export const reservationStatusFilter = { notIn: ['cancelled', 'rejected'] } as const

export function validateReservationWindow(equipmentName: string, startTime: Date, endTime: Date): string | null {
    if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime()) || !(endTime instanceof Date) || Number.isNaN(endTime.getTime())) {
        return '予約日時が不正です。'
    }
    if (endTime <= startTime) return '終了日時は開始日時より後にしてください。'

    const maxHours = equipmentName.toLowerCase().includes('miseq') ? 48 : 12
    const durationHours = (endTime.getTime() - startTime.getTime()) / (60 * 60 * 1000)
    if (durationHours > maxHours) {
        return maxHours === 48 ? 'MiSeqの予約は最長48時間です。' : 'この機器の予約は最長12時間です。'
    }
    return null
}
