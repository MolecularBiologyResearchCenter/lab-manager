import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { getAnnualRegistrationFee, getCurrentQuarter, getPeriodKey, getQuarterDates, getTokyoDateParts, parsePeriodKey } from '@/lib/invoice'
import { redirect } from 'next/navigation'
import InvoiceManager from './InvoiceManager'
import { performanceTrace } from '@/lib/performance'

export default async function AdminInvoicesPage(props: { searchParams: Promise<{ period?: string }> }) {
    const trace = performanceTrace('page.admin.invoices')
    const searchParams = await props.searchParams
    const user = await trace.measure('auth', getCurrentUser)
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR')) redirect('/')

    const now = new Date()
    const todayTokyo = getTokyoDateParts(now)
    const currentPeriodKey = getPeriodKey(todayTokyo.year, getCurrentQuarter(now))
    const [invoices, usageYears, reservationYears] = await Promise.all([
        prisma.invoice.findMany({ select: { id: true, userId: true, fiscalYear: true, quarter: true, invoiceNumber: true, totalAmount: true, status: true, sealedAt: true, sealedBy: true, user: { select: { name: true, department: true, laboratory: true } } }, orderBy: [{ fiscalYear: 'desc' }, { quarter: 'desc' }, { user: { name: 'asc' } }] }),
        prisma.usageLog.findMany({ select: { date: true }, distinct: ['date'] }),
        prisma.reservation.findMany({ select: { startTime: true }, distinct: ['startTime'] }),
    ])
    const years = new Set<number>([todayTokyo.year])
    invoices.forEach((invoice) => years.add(invoice.fiscalYear))
    usageYears.forEach(({ date }) => years.add(getTokyoDateParts(date).year))
    reservationYears.forEach(({ startTime }) => years.add(getTokyoDateParts(startTime).year))
    const periods = [...years]
        .sort((a, b) => a - b)
        .flatMap((year) => [1, 2, 3].map((quarter) => ({ key: getPeriodKey(year, quarter), year, quarter })))
        .slice(-6)
    const requested = parsePeriodKey(searchParams.period ?? '')
    const selectedPeriod = requested && periods.some((period) => period.key === getPeriodKey(requested.year, requested.quarter))
        ? { key: getPeriodKey(requested.year, requested.quarter), year: requested.year, quarter: requested.quarter }
        : periods.find((period) => period.key === currentPeriodKey) ?? periods[periods.length - 1]
    const { start, end } = getQuarterDates(selectedPeriod.year, selectedPeriod.quarter)
    const [usageLogs, reservations, activeUsers] = await trace.measure('prismaQuery', () => Promise.all([
        prisma.usageLog.findMany({ where: { date: { gte: start, lt: end } }, select: { id: true, date: true, quantity: true, totalCost: true, user: { select: { id: true, name: true, role: true } }, reagent: { select: { name: true } } }, orderBy: { date: 'desc' } }),
        prisma.reservation.findMany({ where: { startTime: { lt: end }, endTime: { gt: start } }, select: { id: true, startTime: true, endTime: true, status: true, user: { select: { name: true } }, equipment: { select: { name: true } } }, orderBy: { startTime: 'desc' } }),
        prisma.user.findMany({ where: { role: 'USER', enrollmentStatus: 'ACTIVE' }, select: { id: true, affiliationType: true } }),
    ]))
    const eligibleUsageUserIds = [...new Set(usageLogs.filter((log) => log.user.role === 'USER').map((log) => log.user.id))]
    const annualFeeUserIds = selectedPeriod.quarter === 2 ? activeUsers.filter((user) => getAnnualRegistrationFee(user.affiliationType, selectedPeriod.quarter) > 0).map((user) => user.id) : []
    const generationTargetUserIds = [...new Set([...eligibleUsageUserIds, ...annualFeeUserIds])]
    const generationComplete = generationTargetUserIds.length > 0 && generationTargetUserIds.every((userId) => invoices.some((invoice) => invoice.userId === userId && invoice.fiscalYear === selectedPeriod.year && invoice.quarter === selectedPeriod.quarter))
    trace.finish()
    return <InvoiceManager invoices={invoices} periods={periods} selectedPeriod={selectedPeriod} usageLogs={usageLogs} reservations={reservations} canGenerate={user.role === 'ADMIN' || user.role === 'CENTER_DIRECTOR'} generationComplete={generationComplete} hasGenerationTargets={generationTargetUserIds.length > 0} />
}
