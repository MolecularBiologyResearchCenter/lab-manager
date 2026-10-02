import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const percentile = (values: number[], p: number) => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}

const values = [10, 20, 30, 40, 50]
assert.equal(percentile(values, 0.5), 30)
assert.equal(percentile(values, 0.95), 50)
assert.equal(Math.max(...values), 50)

async function main() {
const [actions, graph, invoices, audit] = await Promise.all([
    readFile('src/app/actions.ts', 'utf8'),
    readFile('src/lib/microsoft-group-sync.ts', 'utf8'),
    readFile('src/app/invoices/page.tsx', 'utf8'),
    readFile('src/app/admin/audit-logs/page.tsx', 'utf8'),
])

for (const operation of ['reservation.create', 'user.register', 'equipment.list', 'auth.login', 'dashboard.user']) {
    assert.match(actions, new RegExp(`performanceTrace\\(['"]${operation}['"]`), operation)
}
assert.match(graph, /performanceTrace\(['"]microsoft\.graph\./)
assert.match(invoices, /performanceTrace\(['"]page\.invoices['"]\)/)
assert.match(audit, /performanceTrace\(['"]page\.admin\.audit-logs['"]\)/)
assert.match(actions, /claimIdempotencyKey/)
assert.match(actions, /Serializable/)

console.log('performance instrumentation self-test passed; production p50/p95/max require exported Vercel logs')
}

void main()
