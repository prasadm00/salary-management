import { afterAll, describe, expect, it } from 'vitest';
import { createTestPrisma } from './testDatabase.js';

const prisma = createTestPrisma();
afterAll(() => prisma.$disconnect());

async function indexNames(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`;
  return rows.map((row) => row.indexname);
}

// See docs/PERFORMANCE.md for the measurements behind these indexes.
describe('database indexes', () => {
  it('has a text-search index on name, email AND employee code', async () => {
    // The search looks in all three columns. If one has no index, PostgreSQL
    // scans the whole table instead (measured: about 6 times slower).
    expect(await indexNames()).toEqual(
      expect.arrayContaining([
        'idx_employees_full_name_trgm',
        'idx_employees_email_trgm',
        'idx_employees_code_trgm',
      ]),
    );
  });

  it('has the indexes the list and analytics queries use', async () => {
    expect(await indexNames()).toEqual(
      expect.arrayContaining([
        'idx_employees_country_department',
        'idx_employees_department',
        'idx_employees_level',
        'idx_employees_status',
        'idx_employees_hire_date',
        'idx_compensations_currency_amount',
        'idx_changes_employee_changed_at',
        'idx_changes_changed_at',
      ]),
    );
  });

  it('has no separate country index, because (country, department) already covers it', async () => {
    expect(await indexNames()).not.toContain('idx_employees_country');
  });
});
