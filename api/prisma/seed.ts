// Run with: npm run seed -w api
// Fills the database with 10,000 fictional employees. Safe to run again.

import { loadEnv } from '../src/config/env.js';
import { createPrismaClient } from '../src/db/prisma.js';
import { generateDataset } from '../src/seed/generateDataset.js';
import { seedDatabase } from '../src/seed/seedDatabase.js';
import { assertSafeToSeed } from '../src/seed/safety.js';

async function main(): Promise<void> {
  const env = loadEnv();
  assertSafeToSeed(env.DATABASE_URL, process.env['SEED_CONFIRM']);

  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const startedAt = Date.now();
    const data = generateDataset();
    const generatedAt = Date.now();

    await seedDatabase(prisma, data);
    const savedAt = Date.now();

    console.log(`Made ${data.employees.length} employees in ${generatedAt - startedAt} ms.`);
    console.log(
      `Saved ${data.changes.length} salary history rows too, in ${savedAt - generatedAt} ms.`,
    );
    console.log(`Total: ${savedAt - startedAt} ms.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
