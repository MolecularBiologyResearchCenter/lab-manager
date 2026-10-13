import assert from 'node:assert/strict'
import { aggregatePerformance, parsePerformanceEntry, type PerformanceSample } from '../src/lib/performance-aggregation'
const now = Date.parse('2026-10-13T05:00:00Z')
const samples: PerformanceSample[] = Array.from({ length: 20 }, (_, i) => ({ category: 'login', timestampMs: now - 1000, durationMs: i + 1 }))
const [login] = aggregatePerformance(samples, '24h', now)
assert.deepEqual(login, { category: 'login', count: 20, min: 1, max: 20, average: 10.5, p50: 10, p95: 19 })
assert.equal(aggregatePerformance([], '24h', now)[0].p95, null)
const boundaries: PerformanceSample[] = [
    { category: 'login', timestampMs: now - 86400000, durationMs: 10 },
    { category: 'login', timestampMs: now - 86400001, durationMs: 20 },
    { category: 'login', timestampMs: now - 7 * 86400000, durationMs: 30 },
    { category: 'login', timestampMs: now - 7 * 86400000 - 1, durationMs: 40 },
    { category: 'login', timestampMs: now + 1, durationMs: 50 },
]
assert.equal(aggregatePerformance(boundaries, '24h', now)[0].count, 1)
assert.equal(aggregatePerformance(boundaries, '7d', now)[0].count, 3)
const secret = 'private@example.test password Cookie token Client Secret'
const entry = { type: 'lab_manager_performance', operation: 'auth.login', durationMs: 5, email: secret, password: secret, token: secret, cookie: secret, clientSecret: secret }
const parsed = parsePerformanceEntry({ timestampInMs: now, message: JSON.stringify(entry), headers: secret })
assert.deepEqual(parsed, { category: 'login', timestampMs: now, durationMs: 5 })
assert.ok(!JSON.stringify(parsed).includes(secret))
for (const bad of [null, [], { ...entry }, { ...entry, timestamp: now, durationMs: -1 }, { ...entry, timestamp: now, durationMs: '50' }, { ...entry, timestamp: now, operation: 'constructor' }, { timestampInMs: now, message: 'null' }, { timestampInMs: now, message: secret }]) {
    assert.equal(parsePerformanceEntry(bad), null)
}
console.log('performance aggregation: statistics, period boundaries and secret stripping passed')

async function testAdminPage() {
    const ts = await import('typescript')
    const { readFile } = await import('node:fs/promises')
    const { runInNewContext } = await import('node:vm')
    let role = 'USER'
    let reads = 0
    const denied = new Error('denied')
    const code = ts.transpileModule(await readFile('src/app/admin/performance/page.tsx', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const exports: any = {}
    runInNewContext(code, { exports, require: (name: string) => {
        if (name === '@/lib/auth') return { requireAdmin: async () => { if (role !== 'ADMIN') throw denied } }
        if (name === '@/lib/performance-storage') return { readPerformanceStatistics: async (period: string) => { reads++; assert.ok(['24h', '7d'].includes(period)); return [] } }
        if (name === '@/lib/performance-aggregation') return { PERFORMANCE_CATEGORIES: {} }
        if (name === 'react/jsx-runtime') return { jsx: (_type: unknown, props: unknown) => props, jsxs: (_type: unknown, props: unknown) => props }
        return {}
    } })
    for (role of ['USER', 'CENTER_DIRECTOR', '']) {
        await assert.rejects(exports.default({ searchParams: Promise.resolve({ period: '7d' }) }), e => e === denied)
    }
    assert.equal(reads, 0, 'authorization must precede reading performance data')
    role = 'ADMIN'
    await exports.default({ searchParams: Promise.resolve({ period: '7d' }) })
    await exports.default({ searchParams: Promise.resolve({ period: 'arbitrary' }) })
    assert.equal(reads, 2)
    console.log('performance page ADMIN-only access and period validation passed')
}
void testAdminPage()
