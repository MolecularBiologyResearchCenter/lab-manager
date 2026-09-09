import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export function isPasswordHash(value: string): boolean {
    return value.startsWith('scrypt$')
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex')
    const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer
    return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedValue: string): Promise<boolean> {
    if (!isPasswordHash(storedValue)) {
        const supplied = Buffer.from(password)
        const stored = Buffer.from(storedValue)
        return supplied.length === stored.length && timingSafeEqual(supplied, stored)
    }

    const [, salt, encodedHash] = storedValue.split('$')
    if (!salt || !encodedHash) return false

    const storedHash = Buffer.from(encodedHash, 'hex')
    const suppliedHash = await scrypt(password, salt, storedHash.length) as Buffer
    return suppliedHash.length === storedHash.length && timingSafeEqual(suppliedHash, storedHash)
}

export function createPasswordResetToken() {
    const token = randomBytes(32).toString('base64url')
    return {
        token,
        tokenHash: hashPasswordResetToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }
}

export function hashPasswordResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export function validatePassword(password: string): boolean {
    return /^(?=.*[0-9])(?=.*[a-z]).{8,}$/.test(password)
}

type ResetUpdate = {
    where: {
        passwordResetTokenHash: string
        passwordResetTokenExpiresAt: { gt: Date }
    }
    data: {
        password: string
        passwordResetTokenHash: null
        passwordResetTokenExpiresAt: null
    }
}

export async function consumePasswordResetToken(
    token: string,
    newPassword: string,
    updateMany: (update: ResetUpdate) => Promise<{ count: number }>,
    now = new Date(),
) {
    const result = await updateMany({
        where: {
            passwordResetTokenHash: hashPasswordResetToken(token),
            passwordResetTokenExpiresAt: { gt: now },
        },
        data: {
            password: await hashPassword(newPassword),
            passwordResetTokenHash: null,
            passwordResetTokenExpiresAt: null,
        },
    })

    if (result.count !== 1) throw new Error('再設定リンクが無効か期限切れです。')
}
