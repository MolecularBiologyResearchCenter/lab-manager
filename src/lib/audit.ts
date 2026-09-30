import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

type AuditActor = {
    id?: string | null
    name?: string | null
    role?: string | null
}

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
        if (forbiddenMetadataKeys.has(key)) continue
        const sanitized = sanitizeMetadata(item as Prisma.InputJsonValue)
        if (sanitized !== undefined) result[key] = sanitized
    }
    return result
}

function inferResult(input: AuditLogInput): 'success' | 'failure' | 'pending' {
    if (input.result) return input.result
    const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata as Record<string, unknown> : null
    return metadata?.result === 'failure' ? 'failure' : metadata?.result === 'pending' ? 'pending' : 'success'
}

/** 監査ログの失敗は本体操作に影響させない。 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                requestId: input.requestId ?? randomUUID(),
                actorId: input.actor?.id ?? null,
                actorName: input.actor?.id ?? 'SYSTEM',
                actorRole: input.actor?.role ?? '不明',
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId ?? null,
                // 個人名・メールアドレス・ファイル名などは保存しない。識別はtargetIdで行う。
                targetLabel: null,
                summary: input.summary,
                result: inferResult(input),
                errorCode: input.errorCode ?? null,
                metadata: sanitizeMetadata(input.metadata),
            },
        })
    } catch (error) {
        console.error('監査ログの記録に失敗しました。', error)
    }
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
