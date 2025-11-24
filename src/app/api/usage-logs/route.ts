import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/app/actions'
import { getCurrentQuarter, getQuarterDates } from '@/lib/invoice'

export async function GET() {
    const user = await getCurrentUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentQuarter = getCurrentQuarter(now)
    const { start, end } = getQuarterDates(now.getFullYear(), currentQuarter)

    const usageLogs = await prisma.usageLog.findMany({
        where: {
            userId: user.id,
            date: {
                gte: start,
                lte: end,
            },
        },
        include: {
            reagent: true,
            user: true,
        },
        orderBy: {
            date: 'desc',
        },
    })

    return NextResponse.json(usageLogs)
}
