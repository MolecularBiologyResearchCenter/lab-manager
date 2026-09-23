import assert from 'node:assert/strict'
import { authorizationStatus, assertUserRole } from '../src/lib/authorization'
import {
    createPasswordResetToken,
    consumePasswordResetToken,
    hashPassword,
    hashPasswordResetToken,
    verifyPassword,
} from '../src/lib/password'
import { createSignedSessionValue, verifySignedSessionValue } from '../src/lib/auth'
import { MAX_INVOICE_PDF_SIZE, sha256Pdf, validateGeneratedInvoicePdf } from '../src/lib/invoice-pdf-security'
import { getActiveInvoiceReminderPeriod, getInvoiceReminderDedupeKey } from '../src/lib/invoice-reminders'

async function main() {
    const password = 'secure123'
    const passwordHash = await hashPassword(password)
    assert.notEqual(passwordHash, password)
    assert.equal(await verifyPassword(password, passwordHash), true)
    assert.equal(await verifyPassword('incorrect123', passwordHash), false)

    const session = createSignedSessionValue('user-123')
    assert.equal(verifySignedSessionValue(session), 'user-123')
    assert.equal(verifySignedSessionValue(`${session}tampered`), null)

    assert.equal(authorizationStatus(null, 'ADMIN'), 401)
    assert.equal(authorizationStatus({ role: 'USER' }, 'ADMIN'), 403)
    assert.equal(authorizationStatus({ role: 'ADMIN' }, 'ADMIN'), null)
    assert.throws(() => assertUserRole({ role: 'USER' }, 'ADMIN'), /権限/)

    const reset = createPasswordResetToken()
    assert.equal(hashPasswordResetToken(reset.token), reset.tokenHash)
    const lifetime = reset.expiresAt.getTime() - Date.now()
    assert.ok(lifetime > 29 * 60 * 1000 && lifetime <= 30 * 60 * 1000)

    let tokenAvailable = true
    const consumeOnce = async (update: Parameters<typeof consumePasswordResetToken>[2] extends (arg: infer T) => Promise<{ count: number }> ? T : never) => {
        const isUnexpired = update.where.passwordResetTokenExpiresAt.gt < reset.expiresAt
        if (!tokenAvailable || !isUnexpired || update.where.passwordResetTokenHash !== reset.tokenHash) return { count: 0 }
        tokenAvailable = false
        assert.equal(update.data.passwordResetTokenHash, null)
        assert.equal(update.data.passwordResetTokenExpiresAt, null)
        return { count: 1 }
    }
    await consumePasswordResetToken(reset.token, 'replacement123', consumeOnce)
    await assert.rejects(() => consumePasswordResetToken(reset.token, 'replacement123', consumeOnce), /無効か期限切れ/)

    const expiredUpdater = async () => ({ count: 0 })
    await assert.rejects(() => consumePasswordResetToken(reset.token, 'replacement123', expiredUpdater, reset.expiresAt), /無効か期限切れ/)

    const validPdf = Buffer.from('%PDF-1.7\nsecure invoice')
    validateGeneratedInvoicePdf(validPdf)
    assert.equal(sha256Pdf(validPdf).length, 64)
    assert.throws(() => validateGeneratedInvoicePdf(Buffer.from('not a pdf')), /INVALID_PDF/)
    assert.throws(() => validateGeneratedInvoicePdf(new Uint8Array(MAX_INVOICE_PDF_SIZE + 1)), /PDF_TOO_LARGE/)

    const tokyo = (value: string) => new Date(`${value}T00:00:00+09:00`)
    assert.equal(getActiveInvoiceReminderPeriod(tokyo('2026-04-30')), null)
    assert.deepEqual(getActiveInvoiceReminderPeriod(tokyo('2026-05-01')), { fiscalYear: 2026, quarter: 1 })
    assert.deepEqual(getActiveInvoiceReminderPeriod(tokyo('2026-08-31')), { fiscalYear: 2026, quarter: 1 })
    assert.deepEqual(getActiveInvoiceReminderPeriod(tokyo('2026-09-01')), { fiscalYear: 2026, quarter: 2 })
    assert.deepEqual(getActiveInvoiceReminderPeriod(tokyo('2026-12-31')), { fiscalYear: 2026, quarter: 2 })
    assert.deepEqual(getActiveInvoiceReminderPeriod(tokyo('2027-01-01')), { fiscalYear: 2026, quarter: 3 })
    assert.equal(getInvoiceReminderDedupeKey({ fiscalYear: 2026, quarter: 1 }), getInvoiceReminderDedupeKey({ fiscalYear: 2026, quarter: 1 }))

    console.log('Security self-test passed.')
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Security self-test failed.')
    process.exit(1)
})
