import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixInvalidReservations() {
    console.log('Checking for invalid reservations...')

    // Find all reservations where endTime <= startTime
    const invalidReservations = await prisma.reservation.findMany({
        where: {
            OR: [
                {
                    endTime: {
                        lte: prisma.reservation.fields.startTime
                    }
                }
            ]
        },
        include: {
            equipment: true,
            user: true
        }
    })

    console.log(`Found ${invalidReservations.length} potentially invalid reservations`)

    // Check each reservation manually since Prisma doesn't support field comparison in where clause
    const actuallyInvalid = []
    for (const reservation of await prisma.reservation.findMany({
        include: {
            equipment: true,
            user: true
        }
    })) {
        if (reservation.endTime <= reservation.startTime) {
            actuallyInvalid.push(reservation)
            console.log(`\nInvalid reservation found:`)
            console.log(`  ID: ${reservation.id}`)
            console.log(`  Equipment: ${reservation.equipment.name}`)
            console.log(`  User: ${reservation.user.name}`)
            console.log(`  Start: ${reservation.startTime}`)
            console.log(`  End: ${reservation.endTime}`)
        }
    }

    if (actuallyInvalid.length === 0) {
        console.log('\nNo invalid reservations found!')
        return
    }

    console.log(`\n\nFound ${actuallyInvalid.length} invalid reservation(s).`)
    console.log('\nOptions:')
    console.log('1. Delete these reservations')
    console.log('2. Exit without changes')
    console.log('\nTo delete, run: npm run fix-reservations -- --delete')

    // Check if --delete flag is present
    if (process.argv.includes('--delete')) {
        console.log('\nDeleting invalid reservations...')
        for (const reservation of actuallyInvalid) {
            await prisma.reservation.delete({
                where: { id: reservation.id }
            })
            console.log(`Deleted reservation ${reservation.id}`)
        }
        console.log('\nAll invalid reservations have been deleted.')
    }
}

fixInvalidReservations()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
