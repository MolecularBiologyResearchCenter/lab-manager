const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const start = new Date('2025-11-27T00:00:00+09:00')
    const end = new Date('2025-11-27T23:59:59+09:00')

    console.log('Checking reservations for:', start.toISOString(), 'to', end.toISOString())

    const reservations = await prisma.reservation.findMany({
        where: {
            startTime: {
                gte: start,
                lte: end
            }
        },
        include: {
            equipment: true,
            user: true
        }
    })

    console.log('Found reservations:', reservations.length)
    reservations.forEach(r => {
        console.log('------------------------------------------------')
        console.log(`ID: ${r.id}`)
        console.log(`Equipment: ${r.equipment.name}`)
        console.log(`User: ${r.user.name}`)
        console.log(`Start (UTC): ${r.startTime.toISOString()}`)
        console.log(`End   (UTC): ${r.endTime.toISOString()}`)
        console.log(`Start (Local): ${r.startTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)
        console.log(`End   (Local): ${r.endTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)
    })
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
