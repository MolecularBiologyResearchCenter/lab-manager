import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteUser() {
    const email = 'fujitani@kitasato-u.ac.jp'

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            console.log(`ユーザー ${email} は見つかりませんでした。`)
            return
        }

        // Delete related data first (due to foreign key constraints)
        await prisma.reservation.deleteMany({
            where: { userId: user.id },
        })

        await prisma.usageLog.deleteMany({
            where: { userId: user.id },
        })

        await prisma.invoice.deleteMany({
            where: { userId: user.id },
        })

        // Delete the user
        await prisma.user.delete({
            where: { email },
        })

        console.log(`✓ ユーザー ${email} とその関連データを削除しました。`)
    } catch (error) {
        console.error('エラーが発生しました:', error)
    } finally {
        await prisma.$disconnect()
    }
}

deleteUser()
