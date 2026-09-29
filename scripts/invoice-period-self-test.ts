import assert from 'node:assert/strict'
import { getAnnualRegistrationChargePeriods, getAnnualRegistrationFee, getCurrentQuarter, getQuarterDates, getPeriodKey } from '../src/lib/invoice'

assert.equal(getCurrentQuarter(new Date('2026-04-30T14:59:59.999Z')), 1)
assert.equal(getCurrentQuarter(new Date('2026-04-30T15:00:00.000Z')), 2)
assert.equal(getCurrentQuarter(new Date('2026-08-31T14:59:59.999Z')), 2)
assert.equal(getCurrentQuarter(new Date('2026-08-31T15:00:00.000Z')), 3)
assert.equal(getCurrentQuarter(new Date('2026-12-31T15:00:00.000Z')), 1)
assert.equal(getPeriodKey(2026, 3), '2026-Q3')

const q3 = getQuarterDates(2026, 3)
assert.equal(q3.start.toISOString(), '2026-08-31T15:00:00.000Z')
assert.equal(q3.end.toISOString(), '2026-12-31T15:00:00.000Z')

const juneRegistrant = getAnnualRegistrationChargePeriods(new Date('2026-06-15T00:00:00.000Z'), 2026, 3)
assert.deepEqual(juneRegistrant.map((period) => period.academicYear), [2026])
assert.equal(getAnnualRegistrationFee('FACULTY_STAFF', new Date('2026-06-15T00:00:00.000Z'), 2026, 3), 5000)

const marchRegistrant = getAnnualRegistrationChargePeriods(new Date('2027-02-15T00:00:00.000Z'), 2027, 2)
assert.deepEqual(marchRegistrant.map((period) => period.academicYear), [2026, 2027])
assert.equal(getAnnualRegistrationFee('GRADUATE_STUDENT', new Date('2027-02-15T00:00:00.000Z'), 2027, 2), 2000)
assert.equal(getAnnualRegistrationFee('UNDERGRADUATE_STUDENT', new Date('2026-06-15T00:00:00.000Z'), 2026, 3), 0)

console.log('invoice period self-test passed')
