import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma: PrismaClient = (globalForPrisma.prisma || new PrismaClient({
    // Query text and parameters are intentionally not printed. The event only
    // exposes safe timing metadata so credentials and personal data stay out of logs.
    log: [{ emit: 'event', level: 'query' }],
})) as PrismaClient

(prisma as unknown as { $on: (event: 'query', listener: (event: { duration: number }) => void) => void }).$on('query', (event) => {
    console.info(JSON.stringify({
        type: 'lab_manager_prisma_query',
        durationMs: event.duration,
    }))
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
