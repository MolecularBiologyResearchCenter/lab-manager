const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking Reservations...')
    const reservations = await prisma.reservation.findMany({
        include: { equipment: true, user: true }
    })

    let reservationErrors = 0
    for (const r of reservations) {
        if (!r.equipment) {
            console.error(`Reservation ${r.id} has no equipment! EquipmentID: ${r.equipmentId}`)
            reservationErrors++
        }
        if (!r.user) {
            console.error(`Reservation ${r.id} has no user! UserID: ${r.userId}`)
            reservationErrors++
        }
    }
    console.log(`Checked ${reservations.length} reservations. Found ${reservationErrors} errors.`)

    console.log('\nChecking UsageLogs...')
    const logs = await prisma.usageLog.findMany({
        include: { reagent: true, user: true }
    })

    let logErrors = 0
    for (const l of logs) {
        if (!l.reagent) {
            console.error(`UsageLog ${l.id} has no reagent! ReagentID: ${l.reagentId}`)
            logErrors++
        }
        if (!l.user) {
            console.error(`UsageLog ${l.id} has no user! UserID: ${l.userId}`)
            logErrors++
        }
    }
    console.log(`Checked ${logs.length} usage logs. Found ${logErrors} errors.`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
