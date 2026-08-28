const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getJsonFromSqlite(table) {
  try {
    const raw = execSync(`sqlite3 dev.db ".mode json" "SELECT * FROM ${table};"`, { encoding: 'utf-8' });
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${table} from dev.db:`, err.message);
    return [];
  }
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    if (!isNaN(val)) return new Date(Number(val));
    return new Date(val);
  }
  return null;
}

async function migrate() {
  console.log('Starting migration from dev.db to Supabase PostgreSQL...');

  // 1. Users
  const users = getJsonFromSqlite('User');
  console.log(`Found ${users.length} users in dev.db`);
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        email: u.email,
        password: u.password,
        department: u.department || null,
        laboratory: u.laboratory || null,
        extension: u.extension || null,
        role: u.role || 'USER',
        nameKana: u.nameKana || null,
        employeeId: u.employeeId || null,
        mailingList: u.mailingList === 1 || u.mailingList === true,
        sealImage: u.sealImage || null,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password,
        department: u.department || null,
        laboratory: u.laboratory || null,
        extension: u.extension || null,
        role: u.role || 'USER',
        nameKana: u.nameKana || null,
        employeeId: u.employeeId || null,
        mailingList: u.mailingList === 1 || u.mailingList === true,
        sealImage: u.sealImage || null,
        createdAt: parseDate(u.createdAt) || new Date(),
        updatedAt: parseDate(u.updatedAt) || new Date(),
      }
    });
  }
  console.log('Users migrated successfully.');

  // 2. Equipment
  const equipments = getJsonFromSqlite('Equipment');
  console.log(`Found ${equipments.length} equipments in dev.db`);
  for (const eq of equipments) {
    await prisma.equipment.upsert({
      where: { id: eq.id },
      update: {
        name: eq.name,
        description: eq.description || null,
        icon: eq.icon || null,
      },
      create: {
        id: eq.id,
        name: eq.name,
        description: eq.description || null,
        icon: eq.icon || null,
        createdAt: parseDate(eq.createdAt) || new Date(),
        updatedAt: parseDate(eq.updatedAt) || new Date(),
      }
    });
  }
  console.log('Equipments migrated successfully.');

  // 3. Reagents
  const reagents = getJsonFromSqlite('Reagent');
  console.log(`Found ${reagents.length} reagents in dev.db`);
  for (const r of reagents) {
    await prisma.reagent.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        unitPrice: Number(r.unitPrice),
        stock: r.stock !== null && r.stock !== undefined ? Number(r.stock) : null,
      },
      create: {
        id: r.id,
        name: r.name,
        unitPrice: Number(r.unitPrice),
        stock: r.stock !== null && r.stock !== undefined ? Number(r.stock) : null,
        createdAt: parseDate(r.createdAt) || new Date(),
        updatedAt: parseDate(r.updatedAt) || new Date(),
      }
    });
  }
  console.log('Reagents migrated successfully.');

  // 4. Reservations
  const reservations = getJsonFromSqlite('Reservation');
  console.log(`Found ${reservations.length} reservations in dev.db`);
  for (const res of reservations) {
    await prisma.reservation.upsert({
      where: { id: res.id },
      update: {
        equipmentId: res.equipmentId,
        userId: res.userId,
        startTime: parseDate(res.startTime),
        endTime: parseDate(res.endTime),
        phoneNumber: res.phoneNumber || null,
      },
      create: {
        id: res.id,
        equipmentId: res.equipmentId,
        userId: res.userId,
        startTime: parseDate(res.startTime),
        endTime: parseDate(res.endTime),
        phoneNumber: res.phoneNumber || null,
        createdAt: parseDate(res.createdAt) || new Date(),
        updatedAt: parseDate(res.updatedAt) || new Date(),
      }
    });
  }
  console.log('Reservations migrated successfully.');

  // 5. UsageLogs
  const usageLogs = getJsonFromSqlite('UsageLog');
  console.log(`Found ${usageLogs.length} usageLogs in dev.db`);
  for (const log of usageLogs) {
    await prisma.usageLog.upsert({
      where: { id: log.id },
      update: {
        userId: log.userId,
        reagentId: log.reagentId,
        quantity: Number(log.quantity),
        totalCost: Number(log.totalCost),
        date: parseDate(log.date) || new Date(),
      },
      create: {
        id: log.id,
        userId: log.userId,
        reagentId: log.reagentId,
        quantity: Number(log.quantity),
        totalCost: Number(log.totalCost),
        date: parseDate(log.date) || new Date(),
        createdAt: parseDate(log.createdAt) || new Date(),
        updatedAt: parseDate(log.updatedAt) || new Date(),
      }
    });
  }
  console.log('UsageLogs migrated successfully.');

  // 6. Invoices
  const invoices = getJsonFromSqlite('Invoice');
  console.log(`Found ${invoices.length} invoices in dev.db`);
  for (const inv of invoices) {
    await prisma.invoice.upsert({
      where: { id: inv.id },
      update: {
        invoiceNumber: inv.invoiceNumber,
        userId: inv.userId,
        fiscalYear: Number(inv.fiscalYear),
        quarter: Number(inv.quarter),
        startDate: parseDate(inv.startDate),
        endDate: parseDate(inv.endDate),
        totalAmount: Number(inv.totalAmount),
        issuedDate: parseDate(inv.issuedDate) || new Date(),
        status: inv.status || 'draft',
        budgetDepartment: inv.budgetDepartment || null,
        budgetCategory: inv.budgetCategory || null,
        budgetCode: inv.budgetCode || null,
        sealedBy: inv.sealedBy || null,
        sealedAt: parseDate(inv.sealedAt) || null,
      },
      create: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        userId: inv.userId,
        fiscalYear: Number(inv.fiscalYear),
        quarter: Number(inv.quarter),
        startDate: parseDate(inv.startDate),
        endDate: parseDate(inv.endDate),
        totalAmount: Number(inv.totalAmount),
        issuedDate: parseDate(inv.issuedDate) || new Date(),
        status: inv.status || 'draft',
        budgetDepartment: inv.budgetDepartment || null,
        budgetCategory: inv.budgetCategory || null,
        budgetCode: inv.budgetCode || null,
        sealedBy: inv.sealedBy || null,
        sealedAt: parseDate(inv.sealedAt) || null,
        createdAt: parseDate(inv.createdAt) || new Date(),
        updatedAt: parseDate(inv.updatedAt) || new Date(),
      }
    });
  }
  console.log('Invoices migrated successfully.');

  // 7. InvoiceItems
  const invoiceItems = getJsonFromSqlite('InvoiceItem');
  console.log(`Found ${invoiceItems.length} invoiceItems in dev.db`);
  for (const item of invoiceItems) {
    await prisma.invoiceItem.upsert({
      where: { id: item.id },
      update: {
        invoiceId: item.invoiceId,
        date: parseDate(item.date),
        itemName: item.itemName,
        unitPrice: Number(item.unitPrice),
        quantity: Number(item.quantity),
        amount: Number(item.amount),
        reservationId: item.reservationId || null,
        reagentLogId: item.reagentLogId || null,
      },
      create: {
        id: item.id,
        invoiceId: item.invoiceId,
        date: parseDate(item.date),
        itemName: item.itemName,
        unitPrice: Number(item.unitPrice),
        quantity: Number(item.quantity),
        amount: Number(item.amount),
        reservationId: item.reservationId || null,
        reagentLogId: item.reagentLogId || null,
        createdAt: parseDate(item.createdAt) || new Date(),
      }
    });
  }
  console.log('InvoiceItems migrated successfully.');

  console.log('Migration finished cleanly!');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
