import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { performanceTrace } from '../src/lib/performance'

// Execute the actual route with isolated dependencies; never connect to a DB.
const source = readFileSync('src/app/api/admin/notifications/route.ts', 'utf8')
const delay = () => new Promise(resolve => setTimeout(resolve, 30))
type Scenario = 'success' | 'fallback' | 'unauthenticated' | 'forbidden' | 'failure'
async function run(code: string, scenario: Scenario) {
    const events: string[] = []
    const logs: any[] = []
    let activeReads = 0
    let maxReads = 0
    const read = async (kind: string) => {
        events.push(kind)
        maxReads = Math.max(maxReads, ++activeReads)
        await delay()
        activeReads--
    }
    const dependencies: Record<string, unknown> = {
        '@/lib/performance': { performanceTrace },
        '@/lib/auth': { getAuthenticatedUser: async () => scenario === 'unauthenticated' ? null : { id: 'test', role: scenario === 'forbidden' ? 'USER' : 'ADMIN' } },
        '@/lib/invoice-reminders': { getActiveInvoiceReminderPeriod: () => null, INVOICE_ISSUE_REMINDER_TYPE: 'INVOICE' },
        '@/lib/prisma': { prisma: {
            user: { findMany: async () => { events.push('sync'); return [] } },
            adminNotification: {
                findMany: async (args: any) => {
                    assert.ok(events.includes('sync'))
                    await read('list')
                    if (scenario === 'failure') throw new Error('simulated DB failure')
                    if (scenario === 'fallback' && args.select.microsoftGroupSyncEmail) throw { code: 'P2022' }
                    return [{ id: 'notice', reads: [], ...(scenario === 'fallback' ? {} : { microsoftGroupSyncEmail: 'private@example.test' }) }]
                },
                count: async () => { assert.ok(events.includes('sync')); await read('count'); return 1 },
            },
        } },
        '@/lib/audit': {
            recordAuditLog: async () => { assert.equal(activeReads, 0); events.push('audit') },
            recordAuthorizationFailure: async () => { events.push('forbidden') },
        },
        '@/lib/api-response': {
            createRequestId: () => 'test-request', API_ERROR_CODES: {},
            apiSuccessResponse: (data: unknown) => ({ status: 200, data }),
            apiErrorResponse: (status: number) => ({ status }),
        },
    }
    const exports: any = {}
    const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    runInNewContext(output, { exports, require: (name: string) => { assert.ok(name in dependencies); return dependencies[name] }, console: { error() {} }, Date })
    const originalInfo = console.info
    console.info = line => logs.push(JSON.parse(line))
    try {
        const response = await exports.GET()
        // Let an already-started independent read settle on failure.
        await delay()
        assert.equal(logs.length, 1)
        assert.ok(!JSON.stringify(logs).includes('private@example.test'))
        return { response: JSON.parse(JSON.stringify(response)), events, maxReads, durationMs: logs[0].durationMs }
    } finally { console.info = originalInfo }
}

async function main() {
    for (const scenario of ['success', 'fallback', 'unauthenticated', 'forbidden', 'failure'] as const) {
        const result = await run(source, scenario)
        assert.equal(result.response.status, ({ success: 200, fallback: 200, unauthenticated: 401, forbidden: 403, failure: 500 })[scenario])
        if (scenario === 'success' || scenario === 'fallback') {
            assert.equal(result.maxReads, 2, 'list and count should overlap')
            assert.equal(result.events.at(-1), 'audit')
            assert.equal(result.response.data.unreadCount, 1)
            assert.equal(result.response.data.notifications[0].isRead, false)
            assert.equal(result.response.data.notifications[0].canRetryMicrosoftGroupSync, scenario === 'success')
            assert.ok(!JSON.stringify(result.response).includes('private@example.test'))
        } else {
            assert.ok(!result.events.includes('audit'))
            if (scenario !== 'failure') assert.ok(!result.events.includes('sync'))
        }
    }
    if (process.argv[2]) {
        const beforeSource = readFileSync(process.argv[2], 'utf8')
        const before: number[] = [], after: number[] = []
        for (let i = 0; i < 10; i++) {
            const a = await run(beforeSource, 'success'), b = await run(source, 'success')
            assert.deepEqual(a.response, b.response)
            assert.deepEqual(a.events, b.events)
            assert.equal(a.maxReads, 1)
            before.push(a.durationMs); after.push(b.durationMs)
        }
        const stats = (values: number[]) => { values.sort((a,b) => a-b); return { p50: values[4], p95: values[9], count: values.length } }
        console.log(JSON.stringify({ kind: 'isolated-mock-not-production', dbReadDelayMs: 30, before: stats(before), after: stats(after) }))
    }
    console.log('notification performance regression tests passed (isolated DB/auth)')
}
void main()
