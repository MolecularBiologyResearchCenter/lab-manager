import assert from 'node:assert/strict'
import { validateReservationWindow } from '../src/lib/reservation-rules'

const date = (value: string) => new Date(value)

assert.equal(validateReservationWindow('3500xL', date('2026-09-25T00:00:00Z'), date('2026-09-25T12:00:00Z')), null)
assert.equal(validateReservationWindow('3500xL', date('2026-09-25T00:00:00Z'), date('2026-09-25T12:00:01Z')), 'この機器の予約は最長12時間です。')
assert.equal(validateReservationWindow('MiSeq', date('2026-09-25T00:00:00Z'), date('2026-09-27T00:00:00Z')), null)
assert.equal(validateReservationWindow('MiSeq', date('2026-09-25T00:00:00Z'), date('2026-09-27T00:00:01Z')), 'MiSeqの予約は最長48時間です。')
assert.equal(validateReservationWindow('3500xL', date('2026-09-25T11:00:00Z'), date('2026-09-25T23:00:00Z')), null)
assert.equal(validateReservationWindow('3500xL', date('2026-09-25T12:00:00Z'), date('2026-09-25T12:00:00Z')), '終了日時は開始日時より後にしてください。')

console.log('reservation rules self-test passed')
