import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { authorizationStatus } from '@/lib/authorization'

const noStoreHeaders = { 'Cache-Control': 'private, no-store' }

export async function GET() {
    try {
        const currentUser = await getAuthenticatedUser()
        const status = authorizationStatus(currentUser, 'ADMIN')
        if (status === 401) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders })
        }
        if (status === 403) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStoreHeaders })
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                employeeId: true,
                role: true,
                department: true,
                laboratory: true,
                extension: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return NextResponse.json(users, { headers: noStoreHeaders })
    } catch (error) {
        console.error('Error fetching users:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500, headers: noStoreHeaders })
    }
}
