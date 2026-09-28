import 'server-only'

import { ConfidentialClientApplication } from '@azure/msal-node'
import { prisma } from '@/lib/prisma'
import { recordAuditLog } from '@/lib/audit'

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const GRAPH_SCOPE = ['https://graph.microsoft.com/.default']
const MAX_RETRIES = 2
const SYNC_FAILURE_NOTIFICATION = 'MICROSOFT_GROUP_SYNC_FAILURE'

type GraphConfig = {
    tenantId: string
    clientId: string
    clientSecret: string
    groupId: string
}

export type MicrosoftGroupSyncResult =
    | { ok: true; operation: 'added' | 'already-member' | 'removed' | 'not-member' | 'not-found'; directoryUserId?: string }
    | { ok: false; operation: 'add' | 'remove'; errorCode: string; directoryUserId?: string }

function getGraphConfig(): GraphConfig | null {
    const tenantId = process.env.MICROSOFT_TENANT_ID?.trim()
    const clientId = process.env.MICROSOFT_CLIENT_ID?.trim()
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim()
    const groupId = process.env.MICROSOFT_GROUP_ID?.trim()
    if (!tenantId || !clientId || !clientSecret || !groupId) return null
    return { tenantId, clientId, clientSecret, groupId }
}

function escapeODataString(value: string) {
    return value.replace(/'/g, "''")
}

function isRetryableStatus(status: number) {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function getGraphErrorCode(body: unknown, fallback: string) {
    if (!body || typeof body !== 'object') return fallback
    const error = (body as { error?: { code?: unknown } }).error
    return typeof error?.code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(error.code)
        ? error.code
        : fallback
}

async function getAccessToken(config: GraphConfig) {
    const client = new ConfidentialClientApplication({
        auth: {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            authority: `https://login.microsoftonline.com/${config.tenantId}`,
        },
    })
    const result = await client.acquireTokenByClientCredential({ scopes: GRAPH_SCOPE })
    if (!result?.accessToken) throw new Error('GRAPH_TOKEN_UNAVAILABLE')
    return result.accessToken
}

async function graphRequest<T>(config: GraphConfig, path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; errorCode: string }> {
    try {
        const accessToken = await getAccessToken(config)
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
            const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
                ...init,
                headers: {
                    accept: 'application/json',
                    ...(init?.body ? { 'content-type': 'application/json' } : {}),
                    authorization: `Bearer ${accessToken}`,
                    ...init?.headers,
                },
                cache: 'no-store',
            })
            const text = await response.text()
            let body: unknown = null
            try {
                body = text ? JSON.parse(text) : null
            } catch {
                body = null
            }
            if (response.ok) return { ok: true, data: (body ?? {}) as T }
            if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
                const retryAfter = Number(response.headers.get('retry-after'))
                const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
                    ? Math.min(retryAfter * 1000, 4000)
                    : 250 * (attempt + 1)
                await new Promise((resolve) => setTimeout(resolve, delayMs))
                continue
            }
            return { ok: false, errorCode: getGraphErrorCode(body, `HTTP_${response.status}`) }
        }
        return { ok: false, errorCode: 'GRAPH_RETRY_EXHAUSTED' }
    } catch (error) {
        return { ok: false, errorCode: error instanceof Error && /^[A-Z0-9_]{1,80}$/.test(error.message) ? error.message : 'GRAPH_REQUEST_FAILED' }
    }
}

async function findDirectoryUser(config: GraphConfig, email: string) {
    const filter = `mail eq '${escapeODataString(email)}' or userPrincipalName eq '${escapeODataString(email)}'`
    const result = await graphRequest<{ value?: Array<{ id?: string; mail?: string | null; userPrincipalName?: string | null }> }>(
        config,
        `/users?$filter=${encodeURIComponent(filter)}&$select=id,mail,userPrincipalName&$top=2`,
    )
    if (!result.ok) return result
    const normalizedEmail = email.toLowerCase()
    const matches = result.data.value?.filter((user) => user.mail?.toLowerCase() === normalizedEmail || user.userPrincipalName?.toLowerCase() === normalizedEmail) ?? []
    const id = matches.length === 1 ? matches[0]?.id : null
    return id ? { ok: true as const, id } : { ok: false as const, errorCode: 'DIRECTORY_USER_NOT_FOUND' }
}

async function syncMembership(config: GraphConfig, directoryUserId: string, enabled: boolean): Promise<MicrosoftGroupSyncResult> {
    const memberPath = `/groups/${encodeURIComponent(config.groupId)}/members/${encodeURIComponent(directoryUserId)}/$ref`
    const membership = await graphRequest<Record<string, never>>(config, memberPath)
    if (enabled) {
        if (membership.ok) return { ok: true, operation: 'already-member', directoryUserId }
        if (membership.errorCode !== 'HTTP_404' && membership.errorCode !== 'Request_ResourceNotFound') {
            return { ok: false, operation: 'add', errorCode: membership.errorCode, directoryUserId }
        }
        const added = await graphRequest<Record<string, never>>(config, `/groups/${encodeURIComponent(config.groupId)}/members/$ref`, {
            method: 'POST',
            body: JSON.stringify({ '@odata.id': `${GRAPH_BASE_URL}/directoryObjects/${encodeURIComponent(directoryUserId)}` }),
        })
        if (added.ok) return { ok: true, operation: 'added', directoryUserId }
        if (added.errorCode === 'Request_BadRequest') {
            const membershipAfterAdd = await graphRequest<Record<string, never>>(config, memberPath)
            if (membershipAfterAdd.ok) return { ok: true, operation: 'already-member', directoryUserId }
        }
        return { ok: false, operation: 'add', errorCode: added.errorCode, directoryUserId }
    }

    if (!membership.ok && membership.errorCode === 'HTTP_404') return { ok: true, operation: 'not-member', directoryUserId }
    if (!membership.ok) return { ok: false, operation: 'remove', errorCode: membership.errorCode, directoryUserId }
    const removed = await graphRequest<Record<string, never>>(config, memberPath, { method: 'DELETE' })
    return removed.ok
        ? { ok: true, operation: 'removed', directoryUserId }
        : removed.errorCode === 'HTTP_404'
            ? { ok: true, operation: 'not-member', directoryUserId }
            : { ok: false, operation: 'remove', errorCode: removed.errorCode, directoryUserId }
}

export async function syncMicrosoftGroupMembership(input: { email: string; enabled: boolean }): Promise<MicrosoftGroupSyncResult> {
    const config = getGraphConfig()
    if (!config) return { ok: false, operation: input.enabled ? 'add' : 'remove', errorCode: 'GRAPH_CONFIG_MISSING' }
    const directoryUser = await findDirectoryUser(config, input.email)
    if (!directoryUser.ok) {
        return input.enabled
            ? { ok: false, operation: 'add', errorCode: directoryUser.errorCode }
            : { ok: true, operation: 'not-found' }
    }
    return syncMembership(config, directoryUser.id, input.enabled)
}

export async function syncUserMicrosoftGroupMembership(input: {
    userId: string
    name: string
    email: string
    enabled: boolean
    actor?: { id?: string | null; name?: string | null; role?: string | null }
    preserveFailureNotification?: boolean
    context?: 'USER_DELETE'
}) {
    const result = await syncMicrosoftGroupMembership({ email: input.email, enabled: input.enabled })
    const status = result.ok ? 'SYNCED' : 'FAILED'
    await prisma.user.update({
        where: { id: input.userId },
        data: {
            microsoftGroupSyncStatus: status,
            microsoftGroupSyncErrorCode: result.ok ? null : result.errorCode,
            microsoftGroupSyncAt: new Date(),
        },
    })

    const isDelete = input.context === 'USER_DELETE' && !input.enabled
    await recordAuditLog({
        actor: input.actor,
        action: isDelete
            ? result.ok
                ? result.operation === 'removed' ? 'MICROSOFT_GROUP_MEMBER_REMOVE_SUCCESS' : 'MICROSOFT_GROUP_MEMBER_NOT_REGISTERED'
                : 'MICROSOFT_GROUP_MEMBER_REMOVE_FAILURE'
            : input.enabled ? 'MICROSOFT_GROUP_MEMBER_ADD' : 'MICROSOFT_GROUP_MEMBER_REMOVE',
        targetType: 'User',
        targetId: input.userId,
        targetLabel: input.name,
        summary: result.ok ? 'Microsoft 365グループのメンバー同期に成功しました。' : 'Microsoft 365グループのメンバー同期に失敗しました。',
        metadata: {
            result: result.ok ? 'success' : 'failure',
            operation: result.ok ? result.operation : result.operation,
            ...(result.ok ? {} : { errorCode: result.errorCode }),
        },
    })

    if (isDelete && !result.ok) {
        await recordAuditLog({
            actor: input.actor,
            action: 'MICROSOFT_GROUP_SYNC_RETRY_PENDING',
            targetType: 'User',
            targetId: input.userId,
            targetLabel: input.name,
            summary: 'Microsoft 365グループからの削除を再試行待ちにしました。',
            metadata: { result: 'pending', errorCode: result.errorCode },
        })
    }

    const dedupeKey = `${SYNC_FAILURE_NOTIFICATION}:${input.userId}`
    if (result.ok) {
        await prisma.adminNotification.updateMany({ where: { dedupeKey, resolvedAt: null }, data: { resolvedAt: new Date(), microsoftDirectoryUserId: null, microsoftGroupSyncErrorCode: null } })
    } else {
        await prisma.adminNotification.upsert({
            where: { dedupeKey },
            create: {
                type: SYNC_FAILURE_NOTIFICATION,
                targetUserId: input.preserveFailureNotification ? null : input.userId,
                name: input.name,
                dedupeKey,
                microsoftDirectoryUserId: result.directoryUserId ?? null,
                microsoftGroupSyncErrorCode: result.errorCode,
            },
            update: {
                resolvedAt: null,
                targetUserId: input.preserveFailureNotification ? null : input.userId,
                name: input.name,
                microsoftDirectoryUserId: result.directoryUserId ?? null,
                microsoftGroupSyncErrorCode: result.errorCode,
            },
        })
    }
    return result
}
