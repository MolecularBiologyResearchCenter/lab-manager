export type GraphConfig = {
    tenantId: string
    clientId: string
    clientSecret: string
    groupId: string
}

export type MicrosoftGroupSyncResult =
    | { ok: true; operation: 'added' | 'already-member' | 'removed' | 'not-member' | 'not-found'; directoryUserId?: string }
    | { ok: false; operation: 'add' | 'remove'; errorCode: string; directoryUserId?: string }

export type MicrosoftGraphRequest = <T>(config: GraphConfig, path: string, init?: RequestInit) => Promise<{ ok: true; data: T } | { ok: false; errorCode: string }>

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

function escapeODataString(value: string) {
    return value.replace(/'/g, "''")
}

export async function findDirectoryUser(config: GraphConfig, email: string, request: MicrosoftGraphRequest) {
    const normalizedEmail = email.trim().toLowerCase()
    const filter = `mail eq '${escapeODataString(normalizedEmail)}' or userPrincipalName eq '${escapeODataString(normalizedEmail)}'`
    const result = await request<{ value?: Array<{ id?: string; mail?: string | null; userPrincipalName?: string | null }> }>(
        config,
        `/users?$filter=${encodeURIComponent(filter)}&$select=id,mail,userPrincipalName&$top=2`,
    )
    if (!result.ok) return result
    const matches = result.data.value?.filter((user) => user.mail?.trim().toLowerCase() === normalizedEmail || user.userPrincipalName?.trim().toLowerCase() === normalizedEmail) ?? []
    const id = matches.length === 1 ? matches[0]?.id : null
    return id ? { ok: true as const, id } : { ok: false as const, errorCode: 'DIRECTORY_USER_NOT_FOUND' }
}

export async function syncMembership(config: GraphConfig, directoryUserId: string, enabled: boolean, request: MicrosoftGraphRequest): Promise<MicrosoftGroupSyncResult> {
    const memberPath = `/groups/${encodeURIComponent(config.groupId)}/members/${encodeURIComponent(directoryUserId)}/$ref`
    const membership = await request<Record<string, never>>(config, memberPath)
    if (enabled) {
        if (membership.ok) return { ok: true, operation: 'already-member', directoryUserId }
        if (membership.errorCode !== 'HTTP_404' && membership.errorCode !== 'Request_ResourceNotFound') {
            return { ok: false, operation: 'add', errorCode: membership.errorCode, directoryUserId }
        }
        const added = await request<Record<string, never>>(config, `/groups/${encodeURIComponent(config.groupId)}/members/$ref`, {
            method: 'POST',
            body: JSON.stringify({ '@odata.id': `${GRAPH_BASE_URL}/directoryObjects/${encodeURIComponent(directoryUserId)}` }),
        })
        if (added.ok) return { ok: true, operation: 'added', directoryUserId }
        if (added.errorCode === 'Request_BadRequest') {
            const membershipAfterAdd = await request<Record<string, never>>(config, memberPath)
            if (membershipAfterAdd.ok) return { ok: true, operation: 'already-member', directoryUserId }
        }
        return { ok: false, operation: 'add', errorCode: added.errorCode, directoryUserId }
    }

    if (!membership.ok && (membership.errorCode === 'HTTP_404' || membership.errorCode === 'Request_ResourceNotFound')) {
        return { ok: true, operation: 'not-member', directoryUserId }
    }
    if (!membership.ok) return { ok: false, operation: 'remove', errorCode: membership.errorCode, directoryUserId }
    const removed = await request<Record<string, never>>(config, memberPath, { method: 'DELETE' })
    return removed.ok
        ? { ok: true, operation: 'removed', directoryUserId }
        : removed.errorCode === 'HTTP_404' || removed.errorCode === 'Request_ResourceNotFound'
            ? { ok: true, operation: 'not-member', directoryUserId }
            : { ok: false, operation: 'remove', errorCode: removed.errorCode, directoryUserId }
}

export async function syncMicrosoftGroupMembershipWithTestRequest(
    input: { email: string; enabled: boolean },
    request: MicrosoftGraphRequest,
): Promise<MicrosoftGroupSyncResult> {
    const config: GraphConfig = {
        tenantId: 'test-tenant',
        clientId: 'test-client',
        clientSecret: 'test-secret-never-logged',
        groupId: 'test-group',
    }
    const normalizedEmail = input.email.trim().toLowerCase()
    if (!normalizedEmail) return { ok: false, operation: input.enabled ? 'add' : 'remove', errorCode: 'EMAIL_MISSING' }
    const directoryUser = await findDirectoryUser(config, normalizedEmail, request)
    if (!directoryUser.ok) {
        return input.enabled
            ? { ok: false, operation: 'add', errorCode: directoryUser.errorCode }
            : { ok: true, operation: 'not-found' }
    }
    return syncMembership(config, directoryUser.id, input.enabled, request)
}
