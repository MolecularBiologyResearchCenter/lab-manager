/* No production DB, cookies, or Graph calls: execute real actions against in-memory adapters. */
import assert from 'node:assert/strict'
import Module from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { auditContext, setAuditActor } from '../src/lib/audit-context'

type Actor = { id: string; name: string; role: string; enrollmentStatus: string; email: string }
type Row = Record<string, any>
const rows: Row[] = []
let actor: Actor | null = null
let duplicate = false
let loginMode = false
let cookieValue = ''
const db: any = {
    auditLog: { create: async ({ data }: { data: Row }) => { rows.push(data); return data } },
    user: { findUnique: async () => loginMode ? actor && ({ ...actor, updatedAt: new Date(0), password: 'hashed-test', registrationType: 'UNIVERSITY' }) : ({ ...actor, mailingList: false, updatedAt: new Date(0), registrationType: 'UNIVERSITY' }), update: async () => ({}) },
    reagent: { findUnique: async () => ({ unitPrice: 100, stock: null, name: 'test' }) },
    usageLog: { create: async () => ({ id: 'usage-1' }) },
    reservation: { findUnique: async () => ({ userId: actor?.id, equipment: { name: 'test' }, startTime: new Date(), endTime: new Date() }), delete: async () => ({}) },
    invoice: { findUnique: async () => ({ id: 'invoice-1', userId: 'test-USER', sealer: null }) },
}
const auth = {
    getAuthenticatedUser: async () => { setAuditActor(actor); return actor },
    requireUser: async () => { setAuditActor(actor); if (!actor) throw new Error('ログインが必要です。'); return actor },
    clearSessionCookie: async () => {},
    setSessionCookie: async () => {},
    credentialUserSelect: {},
    requireCenterDirector: async () => { setAuditActor(actor); if (actor?.role !== 'CENTER_DIRECTOR') throw new Error('権限がありません。'); return actor },
    requireAdmin: async () => { setAuditActor(actor); if (actor?.role !== 'ADMIN') throw new Error('権限がありません。'); return actor },
}
const loader = Module as unknown as { _load: (...args: any[]) => any }
const original = loader._load
loader._load = function (name: string, ...args: any[]) {
    if (name === '@/lib/prisma') return { prisma: db }
    if (name === '@/lib/auth') return auth
    if (name === 'next/cache') return { revalidatePath() {} }
    if (name === 'next/headers') return { cookies: async () => ({ get: () => cookieValue ? { value: cookieValue } : undefined }) }
    if (name === '@/lib/auth-rate-limit') return { getAuthThrottleKeys: async () => [], checkAuthThrottle: async () => ({}), registerLoginFailure: async () => false, resetLoginFailures: async () => false }
    if (name === '@/lib/password') return { verifyPassword: async (password: string) => password === 'valid-test', validatePassword: () => true, hashPassword: async () => 'hashed-test' }
    if (name === 'next/navigation') return { redirect() { throw Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT;replace;/login;307;' }) } }
    if (name === '@/lib/idempotency') return { claimIdempotencyKey: async () => ({ state: duplicate ? 'duplicate' : 'claimed' }), completeIdempotencyKey: async () => {} }
    if (name === '@/lib/microsoft-group-sync') return { syncUserMicrosoftGroupMembership: async () => {} }
    return original.call(this, name, ...args)
}

async function main() {
    const { recordAuditLog, runAuditedOperation } = await import('../src/lib/audit')
    const actions = await import('../src/app/actions')
    const invoiceRoute = await import('../src/app/api/invoices/[id]/route')
    for (const role of ['ADMIN', 'CENTER_DIRECTOR', 'USER']) {
        actor = { id: `test-${role}`, name: `実行者-${role}`, role, enrollmentStatus: 'ACTIVE', email: 'not-logged@example.invalid' }
        rows.length = 0
        loginMode = true
        const credentials = new FormData()
        credentials.set('email', actor.email)
        credentials.set('password', 'valid-test')
        assert.deepEqual(await actions.login(credentials), { success: true })
        credentials.set('password', 'wrong-test')
        assert.equal((await actions.login(credentials)).success, false)
        assert.equal(rows.find(row => row.action === 'LOGIN_FAILURE')?.actorRole, role)
        loginMode = false
        await actions.updateProfile(actor.id, { currentPassword: 'valid-test', newPassword: 'new-test' })
        const view = await invoiceRoute.GET({} as never, { params: Promise.resolve({ id: 'invoice-1' }) })
        assert.equal(view.status, 200)
        assert.equal(rows.find(row => row.action === 'INVOICE_VIEW')?.requestId, view.headers.get('X-Request-ID'))
        const file = new FormData()
        file.set('file', new File(['image-test'], 'test.png', { type: 'image/png' }))
        if (role === 'CENTER_DIRECTOR') {
            await actions.uploadSeal(file)
            assert.ok(rows.some(row => row.action === 'SEAL_IMAGE_UPDATE' && row.actorRole === role && row.result === 'success'))
        } else await assert.rejects(actions.uploadSeal(file))
        assert.ok(!JSON.stringify(rows).includes('image-test'))
        await actions.logReagentUsage(actor.id, 'reagent-1', 1)
        await actions.updateProfile(actor.id, { department: 'not-logged-department', mailingList: true })
        await actions.deleteReservation('reservation-1', 'request-1')
        await assert.rejects(actions.logReagentUsage('someone-else', 'reagent-1', 1))
        await assert.rejects(actions.logout()) // Next redirect must not be a failure.
        for (const action of ['LOGIN_SUCCESS', 'PASSWORD_CHANGE', 'INVOICE_VIEW', 'SERVICE_CREATE', 'PROFILE_UPDATE', 'MAILING_LIST_OPT_IN', 'RESERVATION_CANCEL', 'LOGOUT']) {
            const row = rows.find(row => row.action === action && row.result === 'success')
            assert.ok(row, action)
            assert.equal(row.actorId, actor.id)
            assert.equal(row.actorName, actor.name)
            assert.equal(row.actorRole, role)
            assert.ok(row.requestId)
        }
        const failure = rows.find(row => row.result === 'failure' && row.action === 'SERVICE_CREATE')!
        assert.equal(failure.errorCode, 'FORBIDDEN')
        assert.equal(failure.actorId, actor.id)
        assert.equal(rows.filter(row => row.action === 'LOGOUT').length, 1)
        const profile = rows.filter(row => row.action === 'PROFILE_UPDATE').at(-1)!
        assert.equal(profile.requestId, rows.find(row => row.action === 'MAILING_LIST_OPT_IN')!.requestId)
        duplicate = true
        const before = rows.length
        await actions.deleteReservation('reservation-1', 'request-1')
        assert.equal(rows.length, before)
        duplicate = false
    }
    actor = null
    assert.equal((await invoiceRoute.GET({} as never, { params: Promise.resolve({ id: 'invoice-1' }) })).status, 401)
    actor = { id: 'other-user', name: 'other', role: 'USER', enrollmentStatus: 'ACTIVE', email: 'unused@example.invalid' }
    assert.equal((await invoiceRoute.GET({} as never, { params: Promise.resolve({ id: 'invoice-1' }) })).status, 403)
    actor = null
    rows.length = 0
    await assert.rejects(actions.logReagentUsage('user', 'reagent', 1))
    assert.equal(rows[0].actorId, null)
    assert.equal(rows[0].errorCode, 'AUTH_REQUIRED')
    rows.length = 0
    await recordAuditLog({ action: 'LOGIN_FAILURE', targetType: 'Authentication', summary: '認証失敗', metadata: {
        password: 'secret-canary', passwordHash: 'secret-canary', CLIENT_SECRET: 'secret-canary', access_token: 'secret-canary', resetToken: 'secret-canary', nested: { sealImage: 'secret-canary', email: 'private-canary' },
    } })
    assert.equal(rows[0].result, 'failure')
    assert.ok(!JSON.stringify(rows).includes('canary'))
    rows.length = 0
    await assert.rejects(runAuditedOperation('PROFILE_UPDATE', 'User', 'u', async () => { throw new Error('secret-canary') }))
    assert.ok(!JSON.stringify(rows).includes('canary'))
    await Promise.all(['a', 'b'].map(id => runAuditedOperation('TEST', 'User', id, async () => {
        setAuditActor({ id, name: id, role: 'USER' })
        await new Promise(resolve => setTimeout(resolve, 5))
        assert.equal(auditContext.getStore()?.actor?.id, id)
    })))
    const authSource = readFileSync('src/lib/auth.ts', 'utf8')
    const realAuth = await import('../src/lib/auth')
    for (const role of ['ADMIN', 'CENTER_DIRECTOR', 'USER']) {
        actor = { id: 'audit-reader', name: 'reader', role, enrollmentStatus: 'ACTIVE', email: 'unused@example.invalid' }
        cookieValue = realAuth.createSignedSessionValue(actor.id)
        if (role === 'USER') await assert.rejects(realAuth.requireAdminOrCenterDirector())
        else assert.equal((await realAuth.requireAdminOrCenterDirector()).role, role)
    }
    cookieValue = ''
    await assert.rejects(realAuth.requireAdminOrCenterDirector())
    assert.match(authSource, /user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR'/)
    assert.match(readFileSync('src/app/admin/audit-logs/page.tsx', 'utf8'), /trace.measure\('auth', requireAdminOrCenterDirector\)/)
    function scan(dir: string) {
        for (const item of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, item.name)
            if (item.isDirectory()) scan(path)
            else if (/\.tsx?$/.test(path)) assert.doesNotMatch(readFileSync(path, 'utf8'), /auditLog\.(update|updateMany|delete|deleteMany|upsert)\s*\(/)
        }
    }
    scan('src')
    console.log('audit role/action, failure, isolation, duplicate and secret-protection tests passed (mock DB/Graph)')
}
main().finally(() => { loader._load = original }).catch(() => { console.error('Audit test failed'); process.exitCode = 1 })
