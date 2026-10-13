import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { readPerformanceStatistics } from '@/lib/performance-storage'
import { PERFORMANCE_CATEGORIES, type PerformanceStatistics } from '@/lib/performance-aggregation'

export const dynamic = 'force-dynamic'

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
    await requireAdmin()
    const params = await searchParams
    const period = params.period === '7d' ? '7d' : '24h'
    let rows: PerformanceStatistics[] = []
    let unavailable = false
    try { rows = await readPerformanceStatistics(period) } catch { unavailable = true }
    const format = (value: number | null) => value === null ? '—' : value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
    return <main className="content-wrapper app-page">
        <div className="app-page-header"><h1 className="app-page-title">性能計測</h1>
            <p className="app-page-description">本番環境のサーバー処理時間を自動集計します。単位はミリ秒です。</p></div>
        <nav aria-label="集計期間" className="mb-6 flex gap-3">
            {(['24h', '7d'] as const).map(value => <Link key={value} href={`/admin/performance?period=${value}`} aria-current={value === period ? 'page' : undefined}
                className={`rounded-lg border px-4 py-2 text-sm ${value === period ? 'bg-blue-700 text-white' : 'bg-white text-slate-700'}`}>
                {value === '24h' ? '過去24時間' : '過去7日間'}</Link>)}
        </nav>
        {unavailable ? <p role="alert" className="app-surface p-6">性能データを取得できませんでした。時間をおいて再読み込みしてください。</p> : <div className="app-surface overflow-x-auto p-4">
            <table className="w-full text-sm"><caption className="mb-4 text-left text-slate-500">{period === '24h' ? '過去24時間' : '過去7日間'} · 成功・失敗を含む処理呼び出し単位</caption>
                <thead><tr>{['処理', '件数', '最小', '最大', '平均', 'p50', 'p95'].map(label => <th key={label} scope="col" className="whitespace-nowrap border-b p-3 text-left">{label}</th>)}</tr></thead>
                <tbody>{rows.map(row => <tr key={row.category}><th scope="row" className="whitespace-nowrap border-b p-3 text-left">{PERFORMANCE_CATEGORIES[row.category]}</th>
                    {[row.count, row.min, row.max, row.average, row.p50, row.p95].map((value, i) => <td key={i} className="border-b p-3 tabular-nums">{format(value)}</td>)}</tr>)}</tbody>
            </table>
            {!rows.some(row => row.count) && <p className="p-4 text-slate-500">この期間の計測データはまだありません。自動収集の開始後に表示されます。</p>}
        </div>}
        <p className="mt-4 text-sm text-slate-500">通信・ブラウザー描画時間は含みません。p50は中央値、p95は95%の処理が収まる時間です。関連する内部処理も個別に数えるため、画面の閲覧回数とは一致しません。</p>
        <p className="mt-2 text-sm text-slate-500">自動収集開始前のログは含みません。更新するには期間を選び直すか、ページを再読み込みしてください。</p>
    </main>
}
