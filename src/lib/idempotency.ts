import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const TTL_MS = 10 * 60 * 1000

type Claim = { state: 'claimed' } | { state: 'duplicate'; result: Prisma.JsonValue | null }

export async function claimIdempotencyKey(actorId: string, operation: string, key: string | undefined): Promise<Claim> {
    if (!key || key.length > 128) throw new Error('操作キーが正しくありません。')
    const expiresAt = new Date(Date.now() + TTL_MS)
    try {
        await prisma.idempotencyKey.create({ data: { actorId, operation, key, expiresAt } })
        return { state: 'claimed' }
    } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
        const existing = await prisma.idempotencyKey.findUnique({
            where: { actorId_operation_key: { actorId, operation, key } },
            select: { result: true, expiresAt: true },
        })
        if (!existing || existing.expiresAt <= new Date()) {
            await prisma.idempotencyKey.deleteMany({ where: { actorId, operation, key } })
            await prisma.idempotencyKey.create({ data: { actorId, operation, key, expiresAt } })
            return { state: 'claimed' }
        }
        return { state: 'duplicate', result: existing.result }
    }
}

export async function completeIdempotencyKey(actorId: string, operation: string, key: string, result: Prisma.InputJsonValue) {
    await prisma.idempotencyKey.update({
        where: { actorId_operation_key: { actorId, operation, key } },
        data: { result },
    })
}

export async function releaseIdempotencyKey(actorId: string, operation: string, key: string | undefined) {
    if (!key) return
    await prisma.idempotencyKey.deleteMany({ where: { actorId, operation, key } })
}
