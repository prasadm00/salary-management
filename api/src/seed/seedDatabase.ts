import type { PrismaClient } from '../db/prisma.js';
import type { SeedDataset } from './generateDataset.js';

/** Rows are saved 1,000 at a time. One insert per row would be far slower. */
const BATCH_SIZE = 1000;

/**
 * Saves the generated data. It deletes everything first, so running it again
 * gives the same result instead of duplicates.
 */
export async function seedDatabase(prisma: PrismaClient, data: SeedDataset): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "compensation_changes", "compensations", "employees" RESTART IDENTITY CASCADE',
  );

  // Employees first, because salaries and history point to them.
  await saveInBatches(data.employees, (rows) => prisma.employee.createMany({ data: rows }));
  await saveInBatches(data.compensations, (rows) => prisma.compensation.createMany({ data: rows }));
  await saveInBatches(data.changes, (rows) => prisma.compensationChange.createMany({ data: rows }));

  // We gave the employees their ids, so tell the database to continue after the last one.
  // Without this, the next employee added in the app would try to use id 1 again.
  await prisma.$queryRaw`
    SELECT setval(
      pg_get_serial_sequence('employees', 'id'),
      coalesce((SELECT max(id) FROM employees), 0) + 1,
      false)`;
}

async function saveInBatches<T>(rows: T[], save: (batch: T[]) => Promise<unknown>): Promise<void> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    await save(rows.slice(start, start + BATCH_SIZE));
  }
}
