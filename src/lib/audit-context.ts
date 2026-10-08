import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export type AuditActor = { id?: string | null; name?: string | null; role?: string | null }
type AuditContext = { requestId: string; actor?: AuditActor | null; failureRecorded?: boolean }
export const auditContext = new AsyncLocalStorage<AuditContext>()
export function auditRequestId() { return auditContext.getStore()?.requestId ?? randomUUID() }
export function setAuditActor(actor: AuditActor | null) {
    const context = auditContext.getStore()
    if (context) context.actor = actor
}
