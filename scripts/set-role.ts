
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const args = process.argv.slice(2)
    if (args.length < 2) {
        console.error('Usage: npx tsx scripts/set-role.ts <email> <role>')
        console.error('Roles: USER, ADMIN, CENTER_DIRECTOR')
        process.exit(1)
    }

    const email = args[0]
    const role = args[1].toUpperCase()

    const user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user) {
        console.error(`User with email ${email} not found.`)
        process.exit(1)
    }

    const updatedUser = await prisma.user.update({
        where: { email },
        data: { role },
    })

    console.log(`Updated user ${updatedUser.name} (${updatedUser.email}) to role ${updatedUser.role}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
