
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'mtfuji@kitasato-u.ac.jp'
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        sealImage: '/uploads/seals/director_seal.png'
      }
    })
    console.log(`Successfully updated seal for ${user.name}`)
  } catch (e) {
    console.error('Failed to update seal:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
