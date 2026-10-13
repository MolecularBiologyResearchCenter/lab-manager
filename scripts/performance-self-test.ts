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



async function testTraceLifecycle() {
    const { performanceTrace } = await import('../src/lib/performance')
    const records: Record<string, any>[] = []
    const original = console.info
    console.info = (line: string) => { records.push(JSON.parse(line)) }
    const secret = 'private@example.test password token Cookie Client Secret data:image/png;base64,SECRET'
    try {
        for (const operation of ['auth.login', 'dashboard.user', 'equipment.list', 'page.reservations', 'page.admin.dashboard', 'api.admin.notifications']) {
            const trace = performanceTrace(operation)
            const payload = { sensitive: secret }
            assert.equal(await trace.run(() => trace.measure('prismaQuery', async () => payload)), payload)
            const success = records.at(-1)!
            assert.equal(success.status, 200)
            assert.equal(success.result, 'success')
            assert.match(success.requestId, /^[0-9a-f-]{36}$/)
            assert.ok(['GET', 'POST'].includes(success.method))
            assert.ok(success.path.startsWith('/'))
            assert.ok(success.durationMs >= 0)
            assert.ok(success.stages.prismaQuery >= 0)
            const count = records.length
            trace.finish('failure', { email: secret, status: 500 })
            assert.equal(records.length, count, 'one record per processing invocation')

            const failed = performanceTrace(operation)
            const error = new Error(secret)
            await assert.rejects(failed.run(() => failed.measure('prismaQuery', async () => { throw error })), e => e === error)
            assert.equal(records.at(-1)!.status, 500)
            assert.equal(records.at(-1)!.result, 'failure')
            assert.ok(records.at(-1)!.stages.prismaQuery >= 0)
        }
        for (const status of [400, 401, 403, 429]) {
            performanceTrace('auth.login').finish('failure', { status, email: secret, password: secret, token: secret, cookie: secret, clientSecret: secret, sealImage: secret, path: secret, requestId: secret, errorCode: secret })
            assert.equal(records.at(-1)!.status, status)
            assert.equal(records.at(-1)!.path, '/login')
        }
        const beforeProbe = records.length
        for (const digest of ['DYNAMIC_SERVER_USAGE', 'NEXT_PRERENDER_INTERRUPTED']) {
            const probe = Object.assign(new Error(secret), { digest })
            await assert.rejects(performanceTrace('page.reservations').run(async () => { throw probe }), e => e === probe)
        }
        assert.equal(records.length, beforeProbe, 'static-build probes are not request samples')
        const redirect = performanceTrace('page.reservations')
        const redirectError = new Error(secret)
        await assert.rejects(redirect.run(async () => {
            redirect.finish('success', { status: 307 })
            throw redirectError
        }), e => e === redirectError)
        assert.equal(records.at(-1)!.status, 307)
        assert.equal(new Set(records.map(r => r.requestId)).size, records.length)
        assert.ok(!JSON.stringify(records).includes(secret), 'inputs, output, errors and extra metadata are never logged')
        console.info = () => { throw new Error('logger unavailable') }
        assert.equal(await performanceTrace('dashboard.user').run(async () => 42), 42)
    } finally {
        console.info = original
    }
    console.log('performance lifecycle, failure, redirect and sensitive-data tests passed')
}


// Execute the real server-action bodies with isolated dependencies; no DB or cookies are written.
async function testActionOutcomes() {
    const ts = await import('typescript')
    const { runInNewContext } = await import('node:vm')
    const perf = await import('../src/lib/performance')
    const source = await readFile('src/app/actions.ts', 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    const logs: any[] = []
    const originalInfo = console.info
    const originalError = console.error
    const secret = 'private@example.test'
    let failDb = false
    let validPassword = true
    let blocked = false
    const user = { id: 'test', enrollmentStatus: 'ACTIVE', registrationType: 'NORMAL', updatedAt: new Date(), password: 'SECRET_PASSWORD' }
    const query = async () => { if (failDb) throw new Error(secret); return [] }
    const dependencies: Record<string, unknown> = {
        '@/lib/performance': perf,
        '@/lib/prisma': { prisma: {
            user: { findUnique: async () => { await query(); return user } },
            usageLog: { findMany: query }, reservation: { findMany: query, count: async () => 0 },
        } },
        '@/lib/auth': { requireUser: async () => user, setSessionCookie: async () => {}, credentialUserSelect: {} },
        '@/lib/auth-rate-limit': {
            getAuthThrottleKeys: async () => [], checkAuthThrottle: async () => ({ blocked }),
            registerLoginFailure: async () => false, resetLoginFailures: async () => false,
        },
        '@/lib/password': { verifyPassword: async () => validPassword },
        '@/lib/audit': { recordAuditLog: async () => {}, runAuditedOperation: async (_action: unknown, _target: unknown, _id: unknown, task: () => Promise<unknown>) => task() },
        '@/lib/audit-context': { setAuditActor: () => {} },
        '@/lib/invoice': { getCurrentQuarter: () => 1, getQuarterDates: () => ({ start: new Date(), end: new Date() }), getTokyoDateParts: () => ({ year: 2026 }) },
    }
    const exports: any = {}
    runInNewContext(output, { exports, require: (name: string) => dependencies[name] ?? {}, console, Date })
    console.info = line => logs.push(JSON.parse(line))
    console.error = () => {} // Existing fixed login failure notice.
    try {
        const form = new FormData()
        form.set('email', secret)
        form.set('password', 'SECRET_PASSWORD')
        assert.equal((await exports.login(form)).success, true)
        assert.equal(logs.at(-1).status, 200)
        validPassword = false
        assert.equal((await exports.login(form)).success, false)
        assert.equal(logs.at(-1).status, 401)
        blocked = true
        await exports.login(form)
        assert.equal(logs.at(-1).status, 429)
        blocked = false
        await assert.rejects(exports.login(new FormData()))
        assert.equal(logs.at(-1).status, 400)
        failDb = true
        assert.equal((await exports.login(form)).success, false)
        assert.equal(logs.at(-1).status, 500)
        failDb = false
        assert.equal((await exports.getDashboardData()).totalCost, 0)
        assert.equal(logs.at(-1).status, 200)
        failDb = true
        await assert.rejects(exports.getDashboardData())
        assert.equal(logs.at(-1).status, 500)
        assert.equal(logs.length, 7)
        assert.ok(!JSON.stringify(logs).includes(secret))
        assert.ok(!JSON.stringify(logs).includes('SECRET_PASSWORD'))
    } finally {
        console.info = originalInfo
        console.error = originalError
    }
    console.log('real login/dashboard action success and failure tests passed (isolated DB/auth)')
}

async function runTests() {
    await main()
    await testTraceLifecycle()
    await testActionOutcomes()
}
void runTests()
