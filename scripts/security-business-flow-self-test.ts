import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { authorizationStatus } from '../src/lib/authorization'
import { currentUserSelect, adminUserSelect } from '../src/lib/auth'
import { ANNUAL_REGISTRATION_FEES, getAnnualRegistrationChargePeriods, getAnnualRegistrationFee, getInvoiceIssueDate } from '../src/lib/invoice'
import { AFFILIATION_TYPES, ENROLLMENT_STATUSES } from '../src/lib/user-lifecycle'
import { apiErrorResponse, apiSuccessResponse } from '../src/lib/api-response'
import { syncMicrosoftGroupMembershipWithTestRequest, type GraphConfig, type MicrosoftGraphRequest } from '../src/lib/microsoft-group-sync-core'

function tokyoMidnight(value: string) {
    return new Date(`${value}T00:00:00+09:00`)
}

async function testGraphMock() {
    const calls: Array<{ path: string; method: string }> = []
    const request: MicrosoftGraphRequest = async <T>(config: GraphConfig, path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        calls.push({ path, method })
        assert.equal(config.groupId, 'test-group')
        assert.equal(config.clientSecret, 'test-secret-never-logged')

        if (path.startsWith('/users?')) {
            assert.match(path, /test%40example\.ac\.jp/)
            return { ok: true, data: { value: [{ id: 'entra-user-1', mail: 'test@example.ac.jp' }] } as T }
        }
        if (method === 'POST') return { ok: true, data: {} as T }
        if (method === 'DELETE') return { ok: true, data: {} as T }
        return calls.filter((call) => call.path.includes('/members/')).length === 1
            ? { ok: false, errorCode: 'HTTP_404' }
            : { ok: true, data: {} as T }
    }

    const added = await syncMicrosoftGroupMembershipWithTestRequest({ email: '  TEST@EXAMPLE.AC.JP ', enabled: true }, request)
    assert.deepEqual(added, { ok: true, operation: 'added', directoryUserId: 'entra-user-1' })

    const alreadyRegistered = await syncMicrosoftGroupMembershipWithTestRequest({ email: 'test@example.ac.jp', enabled: true }, request)
    assert.deepEqual(alreadyRegistered, { ok: true, operation: 'already-member', directoryUserId: 'entra-user-1' })

    const notRegistered = await syncMicrosoftGroupMembershipWithTestRequest({ email: 'test@example.ac.jp', enabled: false }, async <T>(_config: GraphConfig, path: string, init?: RequestInit) => {
        if (path.startsWith('/users?')) return { ok: true, data: { value: [{ id: 'entra-user-1', mail: 'test@example.ac.jp' }] } as T }
        assert.equal(init?.method, undefined)
        return { ok: false, errorCode: 'HTTP_404' }
    })
    assert.deepEqual(notRegistered, { ok: true, operation: 'not-member', directoryUserId: 'entra-user-1' })

    const failed = await syncMicrosoftGroupMembershipWithTestRequest({ email: 'test@example.ac.jp', enabled: true }, async <T>(_config: GraphConfig, path: string) => {
        if (path.startsWith('/users?')) return { ok: true, data: { value: [{ id: 'entra-user-1', mail: 'test@example.ac.jp' }] } as T }
        return { ok: false, errorCode: 'HTTP_503' }
    })
    assert.deepEqual(failed, { ok: false, operation: 'add', errorCode: 'HTTP_503', directoryUserId: 'entra-user-1' })
    assert.ok(calls.some((call) => call.method === 'POST' && call.path === '/groups/test-group/members/$ref'))
    assert.ok(!calls.some((call) => call.path.includes('other-group')))
    assert.ok(!JSON.stringify(calls).includes('test-secret-never-logged'))
}

function testBusinessRules() {
    assert.deepEqual(AFFILIATION_TYPES, ['FACULTY_STAFF', 'GRADUATE_STUDENT', 'UNDERGRADUATE_STUDENT'])
    assert.deepEqual(ENROLLMENT_STATUSES, ['ACTIVE', 'SUSPENDED', 'GRADUATED', 'RETIRED'])
    assert.deepEqual(ANNUAL_REGISTRATION_FEES, { FACULTY_STAFF: 5000, GRADUATE_STUDENT: 1000, UNDERGRADUATE_STUDENT: 0 })
    assert.equal(getInvoiceIssueDate(2027, 2)?.toISOString(), '2027-04-30T15:00:00.000Z')
    assert.equal(getAnnualRegistrationFee('FACULTY_STAFF', tokyoMidnight('2026-06-15'), 2026, 3), 5000)
    assert.equal(getAnnualRegistrationFee('GRADUATE_STUDENT', tokyoMidnight('2026-06-15'), 2026, 3), 1000)
    assert.equal(getAnnualRegistrationFee('UNDERGRADUATE_STUDENT', tokyoMidnight('2026-06-15'), 2026, 3), 0)
    assert.equal(getAnnualRegistrationChargePeriods(tokyoMidnight('2027-01-15'), 2027, 2).length, 2)
    assert.equal(authorizationStatus(null, 'ADMIN'), 401)
    assert.equal(authorizationStatus({ role: 'USER' }, 'ADMIN'), 403)
    assert.equal(authorizationStatus({ role: 'ADMIN' }, 'ADMIN'), null)
    assert.equal(authorizationStatus({ role: 'CENTER_DIRECTOR' }, 'CENTER_DIRECTOR'), null)
    assert.equal('password' in currentUserSelect, false)
    assert.equal('password' in adminUserSelect, false)
    assert.equal('sealImage' in currentUserSelect, false)
    assert.equal('sealImage' in adminUserSelect, false)
}

async function testResponseAndSourceContracts() {
    const success = await apiSuccessResponse({ name: 'safe', role: 'USER' })
    const successBody = await success.json()
    assert.equal('password' in successBody, false)
    assert.equal('passwordHash' in successBody, false)
    assert.equal('accessToken' in successBody, false)
    const error = await apiErrorResponse(403, 'FORBIDDEN', '権限がありません。', '管理者に確認してください。')
    const errorBody = await error.json()
    assert.equal(error.status, 403)
    assert.equal(typeof errorBody.requestId, 'string')
    assert.equal('password' in errorBody, false)
    assert.equal('clientSecret' in errorBody, false)

    const schema = await readFile('prisma/schema.prisma', 'utf8')
    assert.match(schema, /@@unique\(\[actorId, operation, key\]\)/)
    assert.match(schema, /model UserAffiliationChange/)
    assert.match(schema, /model AuditLog/)
    const actions = await readFile('src/app/actions.ts', 'utf8')
    assert.match(actions, /if \(mailingList\)[\s\S]*syncUserMicrosoftGroupMembership\([\s\S]*enabled: true/)
    assert.match(actions, /const mailingListChanged = data\.mailingList !== undefined && previousProfile\.mailingList !== data\.mailingList/)
    assert.match(actions, /if \(mailingListChanged\)[\s\S]*syncUserMicrosoftGroupMembership\([\s\S]*enabled: data\.mailingList === true/)
    assert.match(actions, /const shouldDisableMailingList = nextEnrollmentStatus !== 'ACTIVE'/)
    assert.match(actions, /if \(shouldDisableMailingList\)[\s\S]*syncUserMicrosoftGroupMembership\([\s\S]*enabled: false[\s\S]*context: 'USER_STATUS_CHANGE'/)
    assert.match(actions, /context: 'USER_DELETE'/)
    assert.match(actions, /if \(mailingListChanged && !shouldDisableMailingList\)/)
    assert.match(actions, /requireAdmin\(\)/)
    assert.match(actions, /requireCenterDirector\(\)/)
    assert.match(actions, /claimIdempotencyKey/)
    assert.match(actions, /sealedAt: null, sealedBy: null/)
    assert.match(actions, /ADMIN_USER_DELETE_START/)
    assert.match(actions, /INVOICE_SEAL/)
}

async function main() {
    testBusinessRules()
    await testGraphMock()
    await testResponseAndSourceContracts()
    console.log('Security and business flow self-test passed. Microsoft Graph was mocked; no external API was called.')
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Security and business flow self-test failed.')
    process.exit(1)
})
