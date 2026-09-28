import { randomUUID } from 'crypto'

export type PerformanceStage = 'auth' | 'dbConnection' | 'prismaQuery' | 'externalApi' | 'pdf' | 'app' | 'response'

type StageDurations = Partial<Record<PerformanceStage, number>>

function roundMs(value: number) {
    return Math.round(value * 100) / 100
}

export class PerformanceTrace {
    readonly requestId: string
    private readonly startedAt = performance.now()
    private readonly stages: StageDurations = {}

    constructor(readonly operation: string, requestId?: string) {
        this.requestId = requestId ?? randomUUID()
    }

    async measure<T>(stage: PerformanceStage, task: () => Promise<T>) {
        const startedAt = performance.now()
        try {
            return await task()
        } finally {
            this.stages[stage] = roundMs(performance.now() - startedAt)
        }
    }

    mark(stage: PerformanceStage, startedAt: number) {
        this.stages[stage] = roundMs(performance.now() - startedAt)
    }

    finish(result: 'success' | 'failure' = 'success', extra: Record<string, string | number | boolean | null> = {}) {
        const durationMs = roundMs(performance.now() - this.startedAt)
        console.info(JSON.stringify({
            type: 'lab_manager_performance',
            requestId: this.requestId,
            operation: this.operation,
            durationMs,
            stages: this.stages,
            result,
            region: process.env.VERCEL_REGION ?? 'local',
            dbRegion: process.env.SUPABASE_REGION ?? process.env.DB_REGION ?? 'unknown',
            ...extra,
        }))
        return { requestId: this.requestId, durationMs }
    }
}

export function performanceTrace(operation: string, requestId?: string) {
    return new PerformanceTrace(operation, requestId)
}
