import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
}

/** 監査ログの失敗は本体操作に影響させない。 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                actorId: input.actor?.id ?? null,
                actorName: input.actor?.name ?? '不明な実行者',
                actorRole: input.actor?.role ?? '不明',
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId ?? null,
                targetLabel: input.targetLabel ?? null,
                summary: input.summary,
                metadata: input.metadata,
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
        targetLabel: requiredRole,
        summary: '権限のない操作を拒否しました。',
    })
}
