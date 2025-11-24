const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const updates = [
        { old: '3500xL（シーケンサー）', new: '3500xL' },
        { old: 'CFX Duet 右・新（qPCR）', new: 'CFX Duet' },
        { old: 'CFX96 左・旧（qPCR）', new: 'CFX96' },
        { old: 'FUSION（イメージャー）', new: 'FUSION' },
        { old: 'IQ800（イメージャー）', new: 'IQ800' },
        { old: 'MiSeq（NGS）', new: 'MiSeq' },
        { old: 'iD5（プレートリーダー）', new: 'iD5' },
        { old: 'P2室　安全キャビネット', new: '安全キャビネット' },
        { old: 'QX-200（ddPCR)', new: 'QX-200' },
        { old: 'ECLIPS (蛍光顕微鏡）', new: 'ECLIPS' },
        { old: 'NepaGene（遺伝子導入装置）', new: 'NepaGene' },
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
