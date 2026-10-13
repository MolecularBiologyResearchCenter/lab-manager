export const PERFORMANCE_CATEGORIES = {
    login: 'ログイン',
    dashboard: '利用者ダッシュボード',
    reservations: '機器予約',
    admin: '管理者画面',
} as const
export type PerformanceCategory = keyof typeof PERFORMANCE_CATEGORIES
export type PerformancePeriod = '24h' | '7d'

// Only these fixed labels and numeric values may leave the log parser.
const operations: Record<string, PerformanceCategory> = {
    'auth.login': 'login',
    'dashboard.user': 'dashboard',
    'page.reservations': 'reservations',
    'equipment.list': 'reservations',
    'reservation.create': 'reservations',
    'reservation.update': 'reservations',
    'page.admin.dashboard': 'admin',
    'api.admin.notifications': 'admin',
}
export type PerformanceSample = { category: PerformanceCategory; timestampMs: number; durationMs: number }
export type PerformanceStatistics = {
    category: PerformanceCategory; count: number
    min: number | null; max: number | null; average: number | null
    p50: number | null; p95: number | null
}

export function aggregatePerformance(samples: readonly PerformanceSample[], period: PerformancePeriod, now = Date.now()): PerformanceStatistics[] {
    const since = now - (period === '7d' ? 7 : 1) * 86400000
    return (Object.keys(PERFORMANCE_CATEGORIES) as PerformanceCategory[]).map(category => {
        const values = samples.filter(s => s.category === category
            && Number.isFinite(s.timestampMs) && s.timestampMs >= since && s.timestampMs <= now
            && Number.isFinite(s.durationMs) && s.durationMs >= 0).map(s => s.durationMs).sort((a, b) => a - b)
        const count = values.length
        const round = (n: number) => Math.round(n * 100) / 100
        return { category, count, min: count ? values[0] : null, max: count ? values[count - 1] : null,
            average: count ? round(values.reduce((sum, n) => sum + n / count, 0)) : null,
            p50: count ? values[Math.ceil(count * 0.5) - 1] : null,
            p95: count ? values[Math.ceil(count * 0.95) - 1] : null }
    })
}

export function parsePerformanceEntry(value: unknown): PerformanceSample | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const envelope = value as Record<string, unknown>
    let entry = envelope
    if (typeof envelope.message === 'string') {
        try { entry = JSON.parse(envelope.message) } catch { return null }
    }
    if (!entry || typeof entry !== 'object' || entry.type !== 'lab_manager_performance') return null
    const category = typeof entry.operation === 'string' && Object.hasOwn(operations, entry.operation) ? operations[entry.operation] : null
    const timestamp = envelope.timestampInMs ?? envelope.timestamp ?? envelope.created ?? entry.timestamp
    const timestampMs = typeof timestamp === 'number' ? timestamp : typeof timestamp === 'string' ? Date.parse(timestamp) : NaN
    if (!category || !Number.isFinite(timestampMs) || typeof entry.durationMs !== 'number'
        || !Number.isFinite(entry.durationMs) || entry.durationMs < 0) return null
    return { category, timestampMs, durationMs: entry.durationMs }
}
