import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/app/actions'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                user: true,
                sealer: {
                    select: {
                        name: true,
                        sealImage: true,
                    }
                },
                items: {
                    orderBy: {
                        date: 'asc',
                    },
                },
            },
        })

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        // Check if user owns this invoice or is admin or is center director
        if (invoice.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        return NextResponse.json({
            ...invoice,
            viewerRole: user.role,
        })
    } catch (error) {
        console.error('Failed to fetch invoice:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
