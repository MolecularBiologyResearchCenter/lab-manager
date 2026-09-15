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
            return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
        }

        const { id } = await params

        const ownership = await prisma.invoice.findUnique({
            where: { id },
            select: { userId: true },
        })

        if (!ownership) {
            return NextResponse.json({ error: '請求書が見つかりません。' }, { status: 404 })
        }

        if (ownership.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'CENTER_DIRECTOR') {
            return NextResponse.json({ error: 'この請求書を閲覧する権限がありません。' }, { status: 403 })
        }

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                id: true,
                fiscalYear: true,
                quarter: true,
                totalAmount: true,
                budgetDepartment: true,
                budgetCategory: true,
                budgetCode: true,
                user: {
                    select: { name: true, department: true, laboratory: true },
                },
                sealer: {
                    select: {
                        name: true,
                        sealImage: true,
                    }
                },
                items: {
                    select: {
                        id: true,
                        date: true,
                        itemName: true,
                        unitPrice: true,
                        quantity: true,
                        amount: true,
                    },
                    orderBy: {
                        date: 'asc',
                    },
                },
                sealedBy: true,
                sealedAt: true,
            },
        })

        if (!invoice) {
            return NextResponse.json({ error: '請求書が見つかりません。' }, { status: 404 })
        }

        return NextResponse.json({
            ...invoice,
            viewerRole: user.role,
        })
    } catch (error) {
        console.error('Failed to fetch invoice:', error)
        return NextResponse.json({ error: '請求書の取得中にエラーが発生しました。' }, { status: 500 })
    }
}
