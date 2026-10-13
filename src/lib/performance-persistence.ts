import { after } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { PerformanceSample } from './performance-aggregation'

export function schedulePerformanceSample(sample: PerformanceSample) {
    // Preview and local traffic must not contaminate the production statistics.
    if (process.env.VERCEL_ENV !== 'production') return
    const id = randomUUID()
    try {
        after(async () => {
            try {
                const { savePerformanceSample } = await import('./performance-storage')
                await savePerformanceSample(id, sample)
            } catch {
                // Never log Prisma errors: they may contain connection details or parameters.
                console.warn('Performance sample storage unavailable')
            }
        })
    } catch {
        // Outside a request (e.g. build/tests), do not alter application behavior.
    }
}
