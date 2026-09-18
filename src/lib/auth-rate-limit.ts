import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_MAX_FAILURES = 5
export const PASSWORD_RESET_WINDOW_MS = 15 * 60 * 1000
export const PASSWORD_RESET_MAX_REQUESTS = 3

type ThrottleKind = 'LOGIN_ACCOUNT' | 'LOGIN_IP' | 'PASSWORD_RESET_ACCOUNT' | 'PASSWORD_RESET_IP'

type ThrottleKey = {
    kind: ThrottleKind
    key: string
}

function digest(value: string): string {
    return createHash('sha256').update(value).digest('hex')
}

function key(kind: ThrottleKind, value: string): ThrottleKey {
    return { kind, key: digest(`${kind}:${value}`) }
}

async function getClientAddress(): Promise<string> {
    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')
    if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown'
    return headerStore.get('x-real-ip')?.trim() || 'unknown'
}

export async function getAuthThrottleKeys(email: string, kind: 'LOGIN' | 'PASSWORD_RESET') {
    const normalizedEmail = email.trim().toLowerCase()
    const clientAddress = await getClientAddress()
    if (kind === 'LOGIN') {
        return [key('LOGIN_ACCOUNT', normalizedEmail), key('LOGIN_IP', clientAddress)]
    }
    return [key('PASSWORD_RESET_ACCOUNT', normalizedEmail), key('PASSWORD_RESET_IP', clientAddress)]
}

async function releaseExpiredLocks(keys: ThrottleKey[], now: Date): Promise<boolean> {
    const expired = await prisma.authThrottle.findMany({
        where: {
            kind: { in: keys.map((item) => item.kind) },
            key: { in: keys.map((item) => item.key) },
            lockedUntil: { lte: now },
        },
        select: { id: true, lockedUntil: true },
    })
    if (expired.length > 0) {
        await prisma.authThrottle.updateMany({
            where: { id: { in: expired.map((item) => item.id) } },
            data: { attemptCount: 0, windowStartedAt: now, lockedUntil: null },
        })
    }
    return expired.length > 0
}

export async function checkAuthThrottle(keys: ThrottleKey[], now = new Date()) {
    const released = await releaseExpiredLocks(keys, now)
    const records = await prisma.authThrottle.findMany({
        where: {
            kind: { in: keys.map((item) => item.kind) },
            key: { in: keys.map((item) => item.key) },
        },
        select: { lockedUntil: true },
    })
    return { blocked: records.some((record) => record.lockedUntil && record.lockedUntil > now), released }
}

async function registerFailure(
    keys: ThrottleKey[],
    windowMs: number,
    maxAttempts: number,
    now = new Date(),
) {
    let locked = false
    await prisma.$transaction(async (transaction) => {
        for (const item of keys) {
            const existing = await transaction.authThrottle.findUnique({
                where: { kind_key: { kind: item.kind, key: item.key } },
            })
            const windowExpired = !existing || now.getTime() - existing.windowStartedAt.getTime() >= windowMs
            const attemptCount = windowExpired ? 1 : existing.attemptCount + 1
            const hasNewLock = attemptCount >= maxAttempts
            if (hasNewLock) locked = true

            if (!existing) {
                await transaction.authThrottle.create({
                    data: {
                        kind: item.kind,
                        key: item.key,
                        attemptCount,
                        windowStartedAt: now,
                        lockedUntil: hasNewLock ? new Date(now.getTime() + windowMs) : null,
                    },
                })
            } else {
                await transaction.authThrottle.update({
                    where: { id: existing.id },
                    data: {
                        attemptCount,
                        windowStartedAt: windowExpired ? now : existing.windowStartedAt,
                        lockedUntil: hasNewLock ? new Date(now.getTime() + windowMs) : null,
                    },
                })
            }
        }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return locked
}

export async function registerLoginFailure(keys: ThrottleKey[], now = new Date()) {
    return registerFailure(keys, LOGIN_WINDOW_MS, LOGIN_MAX_FAILURES, now)
}

export async function registerPasswordResetRequest(keys: ThrottleKey[], now = new Date()) {
    const status = await checkAuthThrottle(keys, now)
    if (status.blocked) return { allowed: false, newlyLocked: false, released: status.released }
    const newlyLocked = await registerFailure(keys, PASSWORD_RESET_WINDOW_MS, PASSWORD_RESET_MAX_REQUESTS, now)
    return { allowed: !newlyLocked, newlyLocked, released: status.released }
}

export async function resetLoginFailures(keys: ThrottleKey[]) {
    const result = await prisma.authThrottle.deleteMany({
        where: {
            kind: { in: ['LOGIN_ACCOUNT', 'LOGIN_IP'] },
            key: { in: keys.map((item) => item.key) },
        },
    })
    return result.count > 0
}
