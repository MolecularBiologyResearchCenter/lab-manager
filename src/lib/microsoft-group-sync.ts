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

export type MicrosoftGroupMembershipStatus = 'member' | 'not-member' | 'unknown'

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
    const normalizedEmail = email.trim().toLowerCase()
    const filter = `mail eq '${escapeODataString(normalizedEmail)}' or userPrincipalName eq '${escapeODataString(normalizedEmail)}'`
    const result = await graphRequest<{ value?: Array<{ id?: string; mail?: string | null; userPrincipalName?: string | null }> }>(
        config,
        `/users?$filter=${encodeURIComponent(filter)}&$select=id,mail,userPrincipalName&$top=2`,
    )
    if (!result.ok) return result
    const matches = result.data.value?.filter((user) => user.mail?.trim().toLowerCase() === normalizedEmail || user.userPrincipalName?.trim().toLowerCase() === normalizedEmail) ?? []
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

    if (!membership.ok && (membership.errorCode === 'HTTP_404' || membership.errorCode === 'Request_ResourceNotFound')) {
        return { ok: true, operation: 'not-member', directoryUserId }
    }
    if (!membership.ok) return { ok: false, operation: 'remove', errorCode: membership.errorCode, directoryUserId }
    const removed = await graphRequest<Record<string, never>>(config, memberPath, { method: 'DELETE' })
    return removed.ok
        ? { ok: true, operation: 'removed', directoryUserId }
        : removed.errorCode === 'HTTP_404' || removed.errorCode === 'Request_ResourceNotFound'
            ? { ok: true, operation: 'not-member', directoryUserId }
            : { ok: false, operation: 'remove', errorCode: removed.errorCode, directoryUserId }
}

export async function getMicrosoftGroupMembershipStatus(email: string): Promise<MicrosoftGroupMembershipStatus> {
    const config = getGraphConfig()
    const normalizedEmail = email.trim().toLowerCase()
    if (!config || !normalizedEmail) return 'unknown'

    const directoryUser = await findDirectoryUser(config, normalizedEmail)
    if (!directoryUser.ok) return directoryUser.errorCode === 'DIRECTORY_USER_NOT_FOUND' ? 'not-member' : 'unknown'

    const memberPath = `/groups/${encodeURIComponent(config.groupId)}/members/${encodeURIComponent(directoryUser.id)}/$ref`
    const membership = await graphRequest<Record<string, never>>(config, memberPath)
    if (membership.ok) return 'member'
    if (membership.errorCode === 'HTTP_404' || membership.errorCode === 'Request_ResourceNotFound') return 'not-member'
    return 'unknown'
}

export async function syncMicrosoftGroupMembership(input: { email: string; enabled: boolean }): Promise<MicrosoftGroupSyncResult> {
    const config = getGraphConfig()
    if (!config) return { ok: false, operation: input.enabled ? 'add' : 'remove', errorCode: 'GRAPH_CONFIG_MISSING' }
    const normalizedEmail = input.email.trim().toLowerCase()
    if (!normalizedEmail) return { ok: false, operation: input.enabled ? 'add' : 'remove', errorCode: 'EMAIL_MISSING' }
    const directoryUser = await findDirectoryUser(config, normalizedEmail)
    if (!directoryUser.ok) {
        return input.enabled
            ? { ok: false, operation: 'add', errorCode: directoryUser.errorCode }
            : { ok: true, operation: 'not-found' }
    }
    return syncMembership(config, directoryUser.id, input.enabled)
}

async function syncMicrosoftGroupMembershipByDirectoryUserId(directoryUserId: string, enabled: boolean): Promise<MicrosoftGroupSyncResult> {
    const config = getGraphConfig()
    if (!config) return { ok: false, operation: enabled ? 'add' : 'remove', errorCode: 'GRAPH_CONFIG_MISSING', directoryUserId }
    if (!directoryUserId.trim()) return { ok: false, operation: enabled ? 'add' : 'remove', errorCode: 'DIRECTORY_USER_ID_MISSING' }
    return syncMembership(config, directoryUserId.trim(), enabled)
}

export async function syncUserMicrosoftGroupMembership(input: {
    userId: string
    name: string
    email: string
    enabled: boolean
    actor?: { id?: string | null; name?: string | null; role?: string | null }
    preserveFailureNotification?: boolean
    context?: 'USER_DELETE' | 'USER_STATUS_CHANGE'
}) {
    const result = await syncMicrosoftGroupMembership({ email: input.email.trim().toLowerCase(), enabled: input.enabled })
    const status = result.ok ? 'SYNCED' : 'FAILED'
    await prisma.user.update({
        where: { id: input.userId },
        data: {
            microsoftGroupSyncStatus: status,
            microsoftGroupSyncErrorCode: result.ok ? null : result.errorCode,
            microsoftGroupSyncAt: new Date(),
            ...(result.directoryUserId ? { microsoftDirectoryUserId: result.directoryUserId } : {}),
        },
    })

    const isDelete = (input.context === 'USER_DELETE' || input.context === 'USER_STATUS_CHANGE') && !input.enabled
    await recordAuditLog({
        actor: input.actor,
        action: isDelete
            ? result.ok
                ? result.operation === 'removed' ? 'MICROSOFT_GROUP_MEMBER_REMOVE_SUCCESS' : 'MICROSOFT_GROUP_MEMBER_NOT_REGISTERED'
                : 'MICROSOFT_GROUP_MEMBER_REMOVE_FAILURE'
            : input.enabled
                ? result.ok
                    ? result.operation === 'added' ? 'MICROSOFT_GROUP_MEMBER_ADD' : 'MICROSOFT_GROUP_MEMBER_ALREADY_REGISTERED'
                    : 'MICROSOFT_GROUP_MEMBER_ADD_FAILURE'
                : 'MICROSOFT_GROUP_MEMBER_REMOVE',
        targetType: 'User',
        targetId: input.userId,
        targetLabel: input.name,
        summary: result.ok ? 'Microsoft 365グループのメンバー同期に成功しました。' : 'Microsoft 365グループのメンバー同期に失敗しました。',
        metadata: {
            result: result.ok
                ? result.operation === 'added' ? 'added' : result.operation === 'already-member' ? 'already-registered' : 'success'
                : 'failure',
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
        await prisma.adminNotification.updateMany({ where: { dedupeKey, resolvedAt: null }, data: { resolvedAt: new Date(), microsoftDirectoryUserId: null, microsoftGroupSyncErrorCode: null, microsoftGroupSyncEmail: null } })
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
                microsoftGroupSyncEmail: input.preserveFailureNotification ? input.email.trim().toLowerCase() : null,
            },
            update: {
                resolvedAt: null,
                targetUserId: input.preserveFailureNotification ? null : input.userId,
                name: input.name,
                microsoftDirectoryUserId: result.directoryUserId ?? null,
                microsoftGroupSyncErrorCode: result.errorCode,
                microsoftGroupSyncEmail: input.preserveFailureNotification ? input.email.trim().toLowerCase() : null,
            },
        })
    }
    return result
}

export async function retryDeletedUserMicrosoftGroupSync(input: {
    notificationId: string
    actor: { id?: string | null; name?: string | null; role?: string | null }
}) {
    const notification = await prisma.adminNotification.findUnique({
        where: { id: input.notificationId },
        select: {
            id: true,
            type: true,
            name: true,
            microsoftGroupSyncEmail: true,
            microsoftDirectoryUserId: true,
            resolvedAt: true,
        },
    })
    if (!notification || notification.type !== SYNC_FAILURE_NOTIFICATION || notification.resolvedAt || (!notification.microsoftGroupSyncEmail && !notification.microsoftDirectoryUserId)) {
        throw new Error('MICROSOFT_GROUP_RETRY_NOT_AVAILABLE')
    }

    const result = notification.microsoftDirectoryUserId
        ? await syncMicrosoftGroupMembershipByDirectoryUserId(notification.microsoftDirectoryUserId, false)
        : await syncMicrosoftGroupMembership({ email: notification.microsoftGroupSyncEmail!, enabled: false })
    if (result.ok) {
        await prisma.adminNotification.update({
            where: { id: notification.id },
            data: {
                resolvedAt: new Date(),
                microsoftDirectoryUserId: null,
                microsoftGroupSyncErrorCode: null,
                microsoftGroupSyncEmail: null,
            },
        })
        await recordAuditLog({
            actor: input.actor,
            action: result.operation === 'removed' ? 'MICROSOFT_GROUP_MEMBER_REMOVE_SUCCESS' : 'MICROSOFT_GROUP_MEMBER_NOT_REGISTERED',
            targetType: 'AdminNotification',
            targetId: notification.id,
            targetLabel: notification.name,
            summary: '分子生物実験センターグループの削除同期を再試行しました。',
            metadata: { result: result.operation === 'removed' ? 'removed' : 'not-member', source: 'ADMIN_NOTIFICATION_RETRY' },
        })
        return result
    }

    await prisma.adminNotification.update({
        where: { id: notification.id },
        data: { microsoftDirectoryUserId: result.directoryUserId ?? null, microsoftGroupSyncErrorCode: result.errorCode },
    })
    await recordAuditLog({
        actor: input.actor,
        action: 'MICROSOFT_GROUP_SYNC_RETRY_PENDING',
        targetType: 'AdminNotification',
        targetId: notification.id,
        targetLabel: notification.name,
        summary: '分子生物実験センターグループの削除同期を再試行しましたが、再試行待ちです。',
        metadata: { result: 'pending', errorCode: result.errorCode, source: 'ADMIN_NOTIFICATION_RETRY' },
    })
    return result
}
