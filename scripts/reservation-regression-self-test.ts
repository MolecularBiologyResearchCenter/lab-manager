import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateReservationWindow } from '../src/lib/reservation-rules'

async function main() {
const [actions, calendar, dateFormat] = await Promise.all([
    readFile('src/app/actions.ts', 'utf8'),
    readFile('src/components/ReservationCalendar.tsx', 'utf8'),
    readFile('src/lib/date-format.ts', 'utf8'),
])

const date = (value: string) => new Date(value)
assert.equal(validateReservationWindow('3500xL', date('2026-09-25T00:00:00Z'), date('2026-09-25T12:00:00Z')), null)
assert.equal(validateReservationWindow('3500xL', date('2026-09-25T00:00:00Z'), date('2026-09-25T12:00:01Z')), 'この機器の予約は最長12時間です。')
assert.equal(validateReservationWindow('3500xL', date('2026-09-25T00:00:00Z'), date('2026-09-25T00:00:00Z')), '終了日時は開始日時より後にしてください。')

assert.match(actions, /currentUser\.id !== userId/)
assert.match(actions, /enrollmentStatus !== 'ACTIVE'/)
assert.match(actions, /reservationStatusFilter/)
assert.match(actions, /claimIdempotencyKey\(currentUser\.id, 'reservation\.create'/)
assert.match(actions, /Serializable/)
assert.match(actions, /completeIdempotencyKey/)
assert.match(actions, /RESERVATION_CREATE_FAILED/)
assert.match(calendar, /if \(submitting\) return/)
assert.match(calendar, /disabled=\{submitting\}/)
assert.match(dateFormat, /Asia\/Tokyo/)

console.log('reservation regression self-test passed; Graph is not called by this test')
}

void main()
