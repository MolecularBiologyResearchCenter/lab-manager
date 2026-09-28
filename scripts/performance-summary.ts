import { readFile } from 'node:fs/promises'

type Sample = {
    type: 'lab_manager_performance'
    operation: string
    durationMs: number
    stages?: Record<string, number>
    region?: string
    dbRegion?: string
}

const STAGES = ['auth', 'dbConnection', 'prismaQuery', 'externalApi', 'pdf', 'app', 'response'] as const

async function main() {
    const inputPath = process.argv[2]
    if (!inputPath) {
        console.error('Usage: tsx scripts/performance-summary.ts <vercel-json-log-file>')
        process.exit(1)
    }

    const lines = (await readFile(inputPath, 'utf8')).split(/\r?\n/).filter(Boolean)
    const samples = lines.flatMap((line) => {
    try {
        const value = JSON.parse(line) as Partial<Sample>
        return value.type === 'lab_manager_performance' && typeof value.operation === 'string' && typeof value.durationMs === 'number' ? [value as Sample] : []
    } catch {
        return []
    }
    })

    const percentile = (values: number[], p: number) => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
    }

    const byOperation = new Map<string, Sample[]>()
    for (const sample of samples) byOperation.set(sample.operation, [...(byOperation.get(sample.operation) ?? []), sample])

    console.log(`samples=${samples.length}`)
    console.log('rank,operation,p50Ms,p95Ms,maxMs,count,category')
    for (const [[operation, operationSamples], index] of [...byOperation.entries()]
        .sort((a, b) => Math.max(...b[1].map((sample) => sample.durationMs)) - Math.max(...a[1].map((sample) => sample.durationMs)))
        .slice(0, 10)
        .map((entry, index) => [entry, index] as const)) {
    const durations = operationSamples.map((sample) => sample.durationMs)
    const category = operation.includes('pdf') ? 'PDF処理' : operation.includes('api') || operation.includes('page') ? 'アプリ処理' : operation.includes('login') ? '認証' : 'DB/アプリ処理'
        console.log([index + 1, operation, percentile(durations, 0.5), percentile(durations, 0.95), Math.max(...durations), durations.length, category].join(','))
    }

    const stageSamples = new Map<string, number[]>()
    for (const sample of samples) {
        for (const stage of STAGES) {
            const duration = sample.stages?.[stage]
            if (typeof duration === 'number') stageSamples.set(stage, [...(stageSamples.get(stage) ?? []), duration])
        }
    }

    console.log('stage,p50Ms,p95Ms,maxMs,count')
    for (const [stage, durations] of [...stageSamples.entries()].sort((a, b) => Math.max(...b[1]) - Math.max(...a[1]))) {
        console.log([stage, percentile(durations, 0.5), percentile(durations, 0.95), Math.max(...durations), durations.length].join(','))
    }

    const regions = [...new Set(samples.map((sample) => sample.region ?? 'unknown'))].join('|') || 'unknown'
    const dbRegions = [...new Set(samples.map((sample) => sample.dbRegion ?? 'unknown'))].join('|') || 'unknown'
    console.log(`regions=${regions}`)
    console.log(`dbRegions=${dbRegions}`)
}

void main()
