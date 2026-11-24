import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDatabase } from '../tests/testDatabase.js';
import { generateDataset } from './generateDataset.js';
import { seedDatabase } from './seedDatabase.js';

const prisma = createTestPrisma();

beforeEach(() => resetDatabase(prisma));
afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

const counts = async () => ({
  employees: await prisma.employee.count(),
  compensations: await prisma.compensation.count(),
  changes: await prisma.compensationChange.count(),
});

describe('seedDatabase', () => {
  it('saves exactly what the generator made', async () => {
    const data = generateDataset(60, 5);

    await seedDatabase(prisma, data);

    expect(await counts()).toEqual({
      employees: 60,
      compensations: 60,
      changes: data.changes.length,
    });
  });

  it('saves 10,000 employees, each with a unique code and email', async () => {
    const data = generateDataset();

    await seedDatabase(prisma, data);

    expect((await counts()).employees).toBe(10000);
    const [unique] = await prisma.$queryRaw<{ codes: number; emails: number }[]>`
      SELECT count(DISTINCT employee_code)::int AS codes, count(DISTINCT email)::int AS emails
      FROM employees`;
    expect(unique).toEqual({ codes: 10000, emails: 10000 });
  }, 60000);

  it('keeps the current salary equal to the newest history row for every employee', async () => {
    await seedDatabase(prisma, generateDataset(500, 3));

    const [mismatch] = await prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM compensations c
      WHERE c.amount <> (
        SELECT h.new_amount FROM compensation_changes h
        WHERE h.employee_id = c.employee_id
        ORDER BY h.changed_at DESC, h.id DESC LIMIT 1)`;
    expect(mismatch?.total).toBe(0);
  });

  it('can be run again: it replaces the old data and gives the same result, with no duplicates', async () => {
    const data = generateDataset(80, 11);

    // The database adds createdAt and updatedAt itself, so they are left out of the comparison.
    const readEmployees = () =>
      prisma.employee.findMany({
        orderBy: { id: 'asc' },
        omit: { createdAt: true, updatedAt: true },
      });

    await seedDatabase(prisma, data);
    const first = await readEmployees();
    await seedDatabase(prisma, data);
    const second = await readEmployees();

    expect(await counts()).toEqual({
      employees: 80,
      compensations: 80,
      changes: data.changes.length,
    });
    expect(second).toEqual(first);
  });

  it('replaces data that was already there', async () => {
    await seedDatabase(prisma, generateDataset(80, 1));

    await seedDatabase(prisma, generateDataset(20, 2));

    expect((await counts()).employees).toBe(20);
  });

  it('lets people be added afterwards: new ids carry on after the last seeded id', async () => {
    const data = generateDataset(40, 8);
    await seedDatabase(prisma, data);

    const added = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-900001',
        fullName: 'New Person',
        email: 'new.person@acme.example',
        department: 'Engineering',
        jobTitle: 'Engineer',
        level: 'L1',
        country: 'IN',
        hireDate: new Date('2026-01-01'),
      },
    });
    const change = await prisma.compensationChange.create({
      data: {
        employeeId: added.id,
        newAmount: '100.00',
        currency: 'INR',
        reason: 'Initial salary',
      },
    });

    expect(added.id).toBe(41);
    expect(change.id).toBe(data.changes.length + 1);
  });

  it('saves nothing, and does not fail, for an empty dataset', async () => {
    await seedDatabase(prisma, { employees: [], compensations: [], changes: [] });

    expect(await counts()).toEqual({ employees: 0, compensations: 0, changes: 0 });
  });
});
