import { prisma } from '@/lib/prisma'
import { PERFORMANCE_CATEGORIES, type PerformanceSample, type PerformancePeriod, type PerformanceStatistics } from './performance-aggregation'

export async function savePerformanceSample(id: string, sample: PerformanceSample) {
    // Retries of the same delivery cannot create duplicate samples.
    await prisma.performanceSample.createMany({ data: [{ id, category: sample.category, recordedAt: new Date(sample.timestampMs), durationMs: sample.durationMs }], skipDuplicates: true })
    await prisma.performanceSample.deleteMany({ where: { recordedAt: { lt: new Date(Date.now() - 7 * 86400000) } } })
}

export async function readPerformanceStatistics(period: PerformancePeriod, now = new Date()): Promise<PerformanceStatistics[]> {
    const since = new Date(now.getTime() - (period === '7d' ? 7 : 1) * 86400000)
    const rows = await prisma.$queryRaw<Array<{ category: string; count: bigint; min: number; max: number; average: number; p50: number; p95: number }>>`
        SELECT "category", COUNT(*) AS "count", MIN("durationMs") AS "min", MAX("durationMs") AS "max",
            AVG("durationMs") AS "average",
            percentile_disc(0.5) WITHIN GROUP (ORDER BY "durationMs") AS "p50",
            percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationMs") AS "p95"
        FROM "PerformanceSample" WHERE "recordedAt" >= ${since} AND "recordedAt" <= ${now}
        GROUP BY "category"`
    return (Object.keys(PERFORMANCE_CATEGORIES) as PerformanceSample['category'][]).map(category => {
        const row = rows.find(r => r.category === category)
        const round = (n: number) => Math.round(n * 100) / 100
        return { category, count: row ? Number(row.count) : 0, min: row ? round(row.min) : null,
            max: row ? round(row.max) : null, average: row ? round(row.average) : null,
            p50: row ? round(row.p50) : null, p95: row ? round(row.p95) : null }
    })
}
