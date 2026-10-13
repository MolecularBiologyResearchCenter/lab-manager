import { parsePerformanceEntry } from './performance-aggregation'
import { schedulePerformanceSample } from './performance-persistence'
import { auditRequestId } from './audit-context'

export type PerformanceStage = 'auth' | 'dbConnection' | 'prismaQuery' | 'externalApi' | 'pdf' | 'app' | 'response'

type StageDurations = Partial<Record<PerformanceStage, number>>

function roundMs(value: number) {
    return Math.round(value * 100) / 100
}

export class PerformanceTrace {
    readonly requestId: string
    private readonly startedAt = performance.now()
    private readonly stages: StageDurations = {}
    private finished?: { requestId: string; durationMs: number }

    // Fixed route labels only: never use request URLs, headers or action inputs.
    private get route() {
        return ({
            'auth.login': { method: 'POST', path: '/login' },
            'dashboard.user': { method: 'POST', path: '/' },
            'equipment.list': { method: 'POST', path: '/reservations' },
            'page.reservations': { method: 'GET', path: '/reservations' },
            'page.admin.dashboard': { method: 'GET', path: '/admin' },
            'api.admin.notifications': { method: 'GET', path: '/api/admin/notifications' },
        } as Record<string, { method: string; path: string }>)[this.operation]
    }

    // Preserve returned values and thrown errors, and always close the trace.
    async run<T>(task: () => Promise<T>): Promise<T> {
        try {
            const value = await task()
            this.finish()
            return value
        } catch (error) {
            // Next.js static-build probes are control flow, not failed requests.
            if (typeof error === 'object' && error !== null && 'digest' in error
                && (error.digest === 'DYNAMIC_SERVER_USAGE' || error.digest === 'NEXT_PRERENDER_INTERRUPTED')) {
                throw error
            }
            this.finish('failure', { status: 500 })
            throw error
        }
    }

    constructor(readonly operation: string, requestId?: string) {
        this.requestId = requestId ?? auditRequestId()
    }

    async measure<T>(stage: PerformanceStage, task: () => Promise<T>) {
        const startedAt = performance.now()
        try {
            return await task()
        } finally {
            this.stages[stage] = roundMs((this.stages[stage] ?? 0) + performance.now() - startedAt)
        }
    }

    mark(stage: PerformanceStage, startedAt: number) {
        this.stages[stage] = roundMs((this.stages[stage] ?? 0) + performance.now() - startedAt)
    }

    finish(result: 'success' | 'failure' = 'success', extra: Record<string, string | number | boolean | null> = {}) {
        if (this.finished) return this.finished
        const durationMs = roundMs(performance.now() - this.startedAt)
        this.finished = { requestId: this.requestId, durationMs }
        // Explicit allowlist: never spread arbitrary caller metadata into logs.
        const status = typeof extra.status === 'number' && Number.isInteger(extra.status)
            && extra.status >= 100 && extra.status <= 599 ? extra.status : result === 'success' ? 200 : 500
        try {
            console.info(JSON.stringify({
                type: 'lab_manager_performance',
                requestId: this.requestId,
                operation: this.operation,
                durationMs,
                stages: this.stages,
                result,
                region: process.env.VERCEL_REGION ?? 'local',
                dbRegion: process.env.SUPABASE_REGION ?? process.env.DB_REGION ?? 'unknown',
                ...(this.route ? { ...this.route, status, statusKind: this.operation.startsWith('api.') ? 'http-response' : 'server-processing' } : {}),
                ...(typeof extra.generatedCount === 'number' ? { generatedCount: extra.generatedCount } : {}),
            }))
        } catch {
            // Logging must not change application behavior.
        }
        const sample = parsePerformanceEntry({ type: 'lab_manager_performance', operation: this.operation, durationMs, timestamp: Date.now() })
        if (sample) schedulePerformanceSample(sample)
        return this.finished
    }
}

export function performanceTrace(operation: string, requestId?: string) {
    return new PerformanceTrace(operation, requestId)
}
