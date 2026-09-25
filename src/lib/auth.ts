import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { assertUserRole } from '@/lib/authorization'

export const SESSION_COOKIE_NAME = 'session'

export const currentUserSelect = {
    id: true,
    name: true,
    email: true,
    department: true,
    laboratory: true,
    extension: true,
    employeeId: true,
    mailingList: true,
    role: true,
} as const

export const adminUserSelect = {
    id: true,
    name: true,
    email: true,
    employeeId: true,
    mailingList: true,
    role: true,
    department: true,
    laboratory: true,
    extension: true,
    createdAt: true,
} as const

export const credentialUserSelect = {
    id: true,
    password: true,
    updatedAt: true,
} as const

function getAuthSecret(): string {
    const secret = process.env.AUTH_SECRET
    if (secret) return secret
    if (process.env.NODE_ENV === 'production') {
        throw new Error('AUTH_SECRET is required in production')
    }
    return 'development-only-auth-secret'
}

function signSessionPayload(payload: string): string {
    return createHmac('sha256', getAuthSecret()).update(payload).digest('base64url')
}

export function createSignedSessionValue(userId: string, sessionVersion = 0): string {
    if (sessionVersion === 0) return `${userId}.${signSessionPayload(userId)}`
    const payload = `${userId}.${sessionVersion}`
    return `${payload}.${signSessionPayload(payload)}`
}

export function verifySignedSessionValue(value: string): string | null {
    const separator = value.lastIndexOf('.')
    if (separator <= 0) return null

    const payload = value.slice(0, separator)
    const suppliedSignature = Buffer.from(value.slice(separator + 1))
    const expectedSignature = Buffer.from(signSessionPayload(payload))
    if (suppliedSignature.length !== expectedSignature.length) return null

    if (!timingSafeEqual(suppliedSignature, expectedSignature)) return null
    return payload.split('.')[0] || null
}

function getSessionVersion(value: string): number {
    const separator = value.lastIndexOf('.')
    const payload = value.slice(0, separator)
    const parts = payload.split('.')
    return parts.length === 2 && /^\d+$/.test(parts[1]) ? Number(parts[1]) : 0
}

export async function getSessionUserId(): Promise<string | null> {
    const cookieStore = await cookies()
    const value = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!value) return null
    const userId = verifySignedSessionValue(value)
    if (!userId) return null
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { updatedAt: true } })
    const sessionEpoch = getSessionVersion(value)
    // 旧形式のCookieは既存利用者をログアウトさせずに互換維持する。
    // 新形式のCookieはパスワード変更でupdatedAtが変わるため無効化される。
    return user && (sessionEpoch === 0 || user.updatedAt.getTime() === sessionEpoch) ? userId : null
}

export async function setSessionCookie(userId: string, rememberMe = false, sessionEpoch = 0) {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, createSignedSessionValue(userId, sessionEpoch), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    })
}

export async function clearSessionCookie() {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    })
    cookieStore.delete('userId')
}

export async function getAuthenticatedUser() {
    const userId = await getSessionUserId()
    if (!userId) return null

    return prisma.user.findUnique({
        where: { id: userId },
        select: currentUserSelect,
    })
}

export async function requireUser() {
    const user = await getAuthenticatedUser()
    if (!user) throw new Error('ログインが必要です。')
    return user
}

export async function requireRole(role: 'ADMIN' | 'CENTER_DIRECTOR') {
    const user = await requireUser()
    assertUserRole(user, role)
    return user
}

export async function requireAdmin() {
    return requireRole('ADMIN')
}

export async function requireCenterDirector() {
    return requireRole('CENTER_DIRECTOR')
}
