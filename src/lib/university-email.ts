export const KITASATO_EMAIL_DOMAIN = 'kitasato-u.ac.jp'
export const KITASATO_EMAIL_ERROR = '北里大学の学内メールアドレス（kitasato-u.ac.jpで終わるアドレス）を入力してください。'
export const KITASATO_EMAIL_HINT = "登録には北里大学KID'sアカウントのメールアドレスを使用してください。"

export function normalizeEmail(value: unknown) {
    return String(value ?? '').trim().toLowerCase()
}

export function isKitasatoEmail(value: unknown) {
    const email = normalizeEmail(value)
    const at = email.lastIndexOf('@')
    if (at <= 0 || email.indexOf('@') !== at) return false
    const domain = email.slice(at + 1)
    return domain === KITASATO_EMAIL_DOMAIN || domain.endsWith(`.${KITASATO_EMAIL_DOMAIN}`)
}
