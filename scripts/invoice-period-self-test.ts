import assert from 'node:assert/strict'
import { getCurrentQuarter, getQuarterDates, getPeriodKey } from '../src/lib/invoice'

assert.equal(getCurrentQuarter(new Date('2026-04-30T14:59:59.999Z')), 1)
assert.equal(getCurrentQuarter(new Date('2026-04-30T15:00:00.000Z')), 2)
assert.equal(getCurrentQuarter(new Date('2026-08-31T14:59:59.999Z')), 2)
assert.equal(getCurrentQuarter(new Date('2026-08-31T15:00:00.000Z')), 3)
assert.equal(getCurrentQuarter(new Date('2026-12-31T15:00:00.000Z')), 1)
assert.equal(getPeriodKey(2026, 3), '2026-Q3')

const q3 = getQuarterDates(2026, 3)
assert.equal(q3.start.toISOString(), '2026-08-31T15:00:00.000Z')
assert.equal(q3.end.toISOString(), '2026-12-31T15:00:00.000Z')

console.log('invoice period self-test passed')
