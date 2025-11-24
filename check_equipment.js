const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const equipments = await prisma.equipment.findMany()
    console.log('Current Equipment Names:')
    equipments.forEach(eq => console.log(`- ${eq.name}`))
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
