import { createPrismaClient, type PrismaClient } from '../db/prisma.js';

const DEFAULT_TEST_DATABASE_URL = 'postgresql://acme:acme@localhost:5432/salary_management_test';

/** Where the tests connect. CI and other machines can override it with TEST_DATABASE_URL. */
export function testDatabaseUrl(): string {
  return process.env['TEST_DATABASE_URL'] ?? DEFAULT_TEST_DATABASE_URL;
}

/**
 * Safety guard: tests wipe tables, so they may only run against a database whose
 * name ends in `_test`. The message never includes the password.
 */
export function assertIsTestDatabase(connectionString: string): void {
  if (!/^postgres(ql)?:\/\/[^/]*\/[^/?]*_test(\?.*)?$/.test(connectionString)) {
    throw new Error(
      'Refusing to run: the tests will only use a test database (its name must end in "_test"). ' +
        'Set TEST_DATABASE_URL to a database such as salary_management_test.',
    );
  }
}

/** A Prisma client for tests, checked to point at the test database. */
export function createTestPrisma(): PrismaClient {
  const url = testDatabaseUrl();
  assertIsTestDatabase(url);
  return createPrismaClient(url);
}

/**
 * Empties every table and restarts the id counters, so each test starts clean and
 * ids are predictable. One statement, so it stays fast (a few milliseconds).
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "compensation_changes", "compensations", "employees" RESTART IDENTITY CASCADE',
  );
}
