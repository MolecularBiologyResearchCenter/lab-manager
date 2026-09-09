export type AuthorizedRole = 'ADMIN' | 'CENTER_DIRECTOR'

export function authorizationStatus(
    user: { role: string } | null,
    requiredRole: AuthorizedRole,
): 401 | 403 | null {
    if (!user) return 401
    return user.role === requiredRole ? null : 403
}

export function assertUserRole(user: { role: string }, requiredRole: AuthorizedRole) {
    if (user.role !== requiredRole) throw new Error('権限がありません。')
}
