const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const updates = [
        { old: '安全キャビネット', new: '安キャビ' },
    ]

    for (const update of updates) {
        try {
            const equipment = await prisma.equipment.findFirst({
                where: { name: update.old }
            })

            if (equipment) {
                await prisma.equipment.update({
                    where: { id: equipment.id },
                    data: { name: update.new }
                })
                console.log(`Updated: ${update.old} -> ${update.new}`)
            } else {
                console.log(`Not found: ${update.old}`)
            }
        } catch (e) {
            console.error(`Error updating ${update.old}:`, e)
        }
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
