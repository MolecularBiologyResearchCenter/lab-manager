import { PrismaClient } from '@prisma/client'
import { hashPassword, isPasswordHash } from '../src/lib/password'

const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, password: true },
    })

    let migrated = 0
    for (const user of users) {
        if (isPasswordHash(user.password)) continue
        await prisma.user.update({
            where: { id: user.id },
            data: { password: await hashPassword(user.password) },
        })
        migrated += 1
    }

    console.log(`Hashed ${migrated} existing credential(s).`)
}

main()
    .catch((error) => {
        console.error('Credential migration failed:', error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
