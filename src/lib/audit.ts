import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { auditContext, auditRequestId, type AuditActor } from './audit-context'

type AuditLogInput = {
    actor?: AuditActor | null
    action: string
    targetType: string
    targetId?: string | null
    targetLabel?: string | null
    summary: string
    metadata?: Prisma.InputJsonValue
    requestId?: string | null
    result?: 'success' | 'failure' | 'pending'
    errorCode?: string | null
}

const forbiddenMetadataKeys = new Set([
    'password', 'passwordHash', 'secret', 'clientSecret', 'accessToken', 'refreshToken',
    'token', 'tokenHash', 'passwordResetToken', 'passwordResetTokenHash', 'sealImage',
    'email', 'phone', 'phoneNumber',
])

function sanitizeMetadata(value: Prisma.InputJsonValue | undefined): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return value
    if (Array.isArray(value)) return value.map((item) => sanitizeMetadata(item as Prisma.InputJsonValue)) as Prisma.InputJsonArray
    if (typeof value !== 'object') return value
    const result: Record<string, Prisma.InputJsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
        if (forbiddenMetadataKeys.has(key) || /password|secret|token|authorization|cookie|sealimage|email|phone/i.test(key)) continue
        const sanitized = sanitizeMetadata(item as Prisma.InputJsonValue)
        if (sanitized !== undefined) result[key] = sanitized
    }
    return result
}

function inferResult(input: AuditLogInput): 'success' | 'failure' | 'pending' {
    if (input.result) return input.result
    const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata as Record<string, unknown> : null
    return metadata?.result === 'failure' || /FAIL|DENIED|RESTRICTED|EXPIRED|THROTTLE_LOCK/.test(input.action) ? 'failure' : metadata?.result === 'pending' ? 'pending' : 'success'
}

/** 監査ログの失敗は本体操作に影響させない。 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
    const context = auditContext.getStore()
    const actor = input.actor?.id ? input.actor : context?.actor ?? input.actor
    const result = inferResult(input)
    const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata as Record<string, unknown> : undefined
    const suppliedCode = input.errorCode ?? metadata?.errorCode ?? metadata?.reason
    const errorCode = typeof suppliedCode === 'string' && /^[A-Z0-9_]{1,80}$/.test(suppliedCode) ? suppliedCode : result === 'failure' ? 'OPERATION_FAILED' : null
    try {
        await prisma.auditLog.create({
            data: {
                requestId: input.requestId ?? (typeof metadata?.requestId === 'string' ? metadata.requestId : undefined) ?? context?.requestId ?? randomUUID(),
                actorId: actor?.id ?? null,
                actorName: actor?.name ?? (actor?.id ? '氏名未取得' : '未認証'),
                actorRole: actor?.role ?? 'UNKNOWN',
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId ?? null,
                // 個人名・メールアドレス・ファイル名などは保存しない。識別はtargetIdで行う。
                targetLabel: null,
                summary: input.summary,
                result,
                errorCode,
                metadata: sanitizeMetadata(input.metadata),
            },
        })
        if (context && result === 'failure') context.failureRecorded = true
    } catch {
        console.error(JSON.stringify({ code: 'AUDIT_WRITE_FAILED', requestId: input.requestId ?? context?.requestId }))
    }
}

/** Capture rejected operations without serializing inputs, returned data, or exceptions. */
export async function runAuditedOperation<T>(action: string, targetType: string, targetId: string | null, operation: () => Promise<T>): Promise<T> {
    return auditContext.run({ requestId: auditRequestId(), actor: auditContext.getStore()?.actor }, async () => {
        const failure = async (error?: unknown) => {
            const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
            const errorCode = /権限|他のユーザー/.test(message) ? 'FORBIDDEN' : /ログインが必要/.test(message) ? 'AUTH_REQUIRED' : /既に予約|同時に別/.test(message) ? 'RESERVATION_CONFLICT' : /最長|終了日時|開始日時/.test(message) ? 'INVALID_RESERVATION_WINDOW' : /パスワード/.test(message) ? 'INVALID_CREDENTIALS' : 'OPERATION_FAILED'
            if (!auditContext.getStore()?.failureRecorded) await recordAuditLog({
                action, targetType, targetId, summary: '操作に失敗しました。', result: 'failure', errorCode,
            })
        }
        try {
            const result = await operation()
            if (result && typeof result === 'object' && 'success' in result && result.success === false) await failure('error' in result ? result.error : undefined)
            if (result instanceof Response && result.status >= 400) await failure(result.status === 403 ? '権限' : result.status === 401 ? 'ログインが必要' : undefined)
            return result
        } catch (error) {
            // Next.js redirects are successful control flow, not operation failures.
            const digest = error && typeof error === 'object' && 'digest' in error ? error.digest : null
            if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT;')) await failure(error)
            throw error
        }
    })
}

export async function recordAuthorizationFailure(actor: AuditActor | null, requiredRole: string) {
    await recordAuditLog({
        actor,
        action: 'AUTHZ_DENIED',
        targetType: 'Authorization',
        targetId: requiredRole,
        summary: '権限のない操作を拒否しました。',
        result: 'failure',
        errorCode: 'FORBIDDEN',
    })
}
