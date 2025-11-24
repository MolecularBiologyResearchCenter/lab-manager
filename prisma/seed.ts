import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lab.com' },
    update: {
      password: 'admin',
      department: '医学部',
      laboratory: '管理室',
      extension: '0000',
    },
    create: {
      email: 'admin@lab.com',
      name: '管理者',
      role: 'ADMIN',
      password: 'admin', // Default password
      laboratory: '管理室',
      extension: '0000',
    },
  })

  console.log({ admin })

  // Create Equipment Items
  const equipmentList = [
    '3500xL（シーケンサー）',
    'CFX Duet 右・新（qPCR）',
    'CFX96 左・旧（qPCR）',
    'FUSION（イメージャー）',
    'IQ800（イメージャー）',
    'MiSeq（NGS）',
    'iD5（プレートリーダー）',
    'TapeStation',
    'Qubit',
    '安キャビ',
    'QX-200（ddPCR)',
    'ECLIPS (蛍光顕微鏡）',
    'NepaGene（遺伝子導入装置）',
  ]

  // Clear existing equipment to avoid duplicates if re-seeding without reset (though we will reset)
  // But for safety in future, upsert is better, but names might change. 
  // Since we are doing a reset, simple create is fine.

  for (const name of equipmentList) {
    await prisma.equipment.create({
      data: {
        name,
        description: 'ラボ機器',
      },
    })
  }
  console.log(`Seeded ${equipmentList.length} equipment items`)

  // Create Reagents
  const reagentList = [
    { name: 'シーケンサー', price: 5600 },
    { name: 'LB plate', price: 40 },
    { name: 'competent cells', price: 100 },
    { name: 'Qubit', price: 70 },
    { name: 'TapeStation genome', price: 11000 },
    { name: 'TapeStation HS D1000', price: 12000 },
    { name: 'TapeStation RNA', price: 8600 },
    { name: 'Covaris', price: 1100 },
    { name: '96 well white plate (Thermo)', price: 600 },
    { name: '96 well white plate (BioRad)', price: 800 },
    { name: '96 well white plate (Treff)', price: 350 },
    { name: '96 well clear plate (bioramo)', price: 150 },
    { name: '96 well sequence plate', price: 350 },
    { name: 'sequencer septa', price: 2000 },
    { name: 'Midi prep', price: 1800 },
    { name: 'Mini prep', price: 300 },
    { name: 'TapeStation 消耗品', price: 50 },
    { name: '外注用 96 well plate', price: 300 },
  ]

  for (const item of reagentList) {
    await prisma.reagent.create({
      data: {
        name: item.name,
        unitPrice: item.price,
        stock: 100, // Default stock
      },
    })
  }
  console.log(`Seeded ${reagentList.length} reagents`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
