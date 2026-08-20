
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const args = process.argv.slice(2)
    if (args.length < 1) {
        console.error('Usage: npx tsx scripts/get-password.ts <email>')
        process.exit(1)
    }

    const email = args[0]

    const user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user) {
        console.error(`User with email ${email} not found.`)
        process.exit(1)
    }

    console.log(`Password for ${email}: ${user.password}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
