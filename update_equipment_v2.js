const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const updates = [
        { old: 'TapeStation 4200', new: 'TapeStation' },
        { old: 'P2室　安全キャビネット', new: '安キャビ' },
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
                // Check if already updated
                const newEq = await prisma.equipment.findFirst({
                    where: { name: update.new }
                })
                if (newEq) {
                    console.log(`(Already exists: ${update.new})`)
                }
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
