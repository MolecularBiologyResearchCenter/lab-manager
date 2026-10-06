import assert from 'node:assert/strict'
import { isKitasatoEmail, normalizeEmail } from '../src/lib/university-email'

assert.equal(normalizeEmail('  USER@KITASATO-U.AC.JP '), 'user@kitasato-u.ac.jp')
assert.equal(isKitasatoEmail('  USER@KITASATO-U.AC.JP '), true)
assert.equal(isKitasatoEmail('user@med.kitasato-u.ac.jp'), true)
assert.equal(isKitasatoEmail('user@example.com'), false)
assert.equal(isKitasatoEmail('user@kitasato-u.ac.jp.example.com'), false)
assert.equal(isKitasatoEmail('user@kitasato-u.ac.jp.evil'), false)
assert.equal(isKitasatoEmail('@kitasato-u.ac.jp'), false)
assert.equal(isKitasatoEmail('user@@kitasato-u.ac.jp'), false)

console.log('University email validation self-test passed.')
