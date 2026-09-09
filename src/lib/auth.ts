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
    role: true,
} as const

function getAuthSecret(): string {
    const secret = process.env.AUTH_SECRET
    if (secret) return secret
    if (process.env.NODE_ENV === 'production') {
        throw new Error('AUTH_SECRET is required in production')
    }
    return 'development-only-auth-secret'
}

function signUserId(userId: string): string {
    return createHmac('sha256', getAuthSecret()).update(userId).digest('base64url')
}

export function createSignedSessionValue(userId: string): string {
    return `${userId}.${signUserId(userId)}`
}

export function verifySignedSessionValue(value: string): string | null {
    const separator = value.lastIndexOf('.')
    if (separator <= 0) return null

    const userId = value.slice(0, separator)
    const suppliedSignature = Buffer.from(value.slice(separator + 1))
    const expectedSignature = Buffer.from(signUserId(userId))
    if (suppliedSignature.length !== expectedSignature.length) return null

    return timingSafeEqual(suppliedSignature, expectedSignature) ? userId : null
}

export async function getSessionUserId(): Promise<string | null> {
    const cookieStore = await cookies()
    const value = cookieStore.get(SESSION_COOKIE_NAME)?.value
    return value ? verifySignedSessionValue(value) : null
}

export async function setSessionCookie(userId: string, rememberMe = false) {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, createSignedSessionValue(userId), {
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
