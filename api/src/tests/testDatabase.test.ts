import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { checkDatabase } from '../db/prisma.js';
import {
  assertIsTestDatabase,
  createTestPrisma,
  resetDatabase,
  testDatabaseUrl,
} from './testDatabase.js';

describe('assertIsTestDatabase (the safety guard)', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(() =>
      assertIsTestDatabase('postgresql://acme:acme@localhost:5432/salary_management_test'),
    ).not.toThrow();
  });

  it('accepts a _test database with query parameters', () => {
    expect(() =>
      assertIsTestDatabase('postgresql://acme:acme@localhost:5432/salary_management_test?x=1'),
    ).not.toThrow();
  });

  it.each([
    'postgresql://acme:acme@localhost:5432/salary_management',
    'postgresql://acme:acme@localhost:5432/test_salary_management',
    'postgresql://acme:acme@localhost:5432/',
    'not a url',
  ])('refuses %s so real data can never be wiped', (url) => {
    expect(() => assertIsTestDatabase(url)).toThrowError(/test database/i);
  });

  it('does not print the password when refusing', () => {
    const attempt = () => assertIsTestDatabase('postgresql://acme:hunter2@localhost:5432/prod');

    expect(attempt).toThrowError();
    expect(attempt).not.toThrowError(/hunter2/);
  });

  it('the configured test database passes the guard', () => {
    expect(() => assertIsTestDatabase(testDatabaseUrl())).not.toThrow();
  });
});

describe('test database', () => {
  const prisma = createTestPrisma();

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has the migrated tables', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
      ORDER BY table_name`;

    expect(tables.map((table) => table.table_name)).toEqual([
      'compensation_changes',
      'compensations',
      'employees',
    ]);
  });

  it('has the pg_trgm extension used by the search indexes', async () => {
    const rows = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;

    expect(rows).toHaveLength(1);
  });

  it('starts every test with empty tables', async () => {
    await prisma.employee.create({ data: anEmployeeRow('EMP-000001', 'a@acme.example') });
    await resetDatabase(prisma);

    expect(await prisma.employee.count()).toBe(0);
  });

  it('removes rows in child tables too, in one reset', async () => {
    const employee = await prisma.employee.create({
      data: anEmployeeRow('EMP-000001', 'a@acme.example'),
    });
    await prisma.compensation.create({
      data: {
        employeeId: employee.id,
        amount: '100.00',
        currency: 'USD',
        effectiveDate: new Date('2024-01-01'),
      },
    });

    await resetDatabase(prisma);

    expect(await prisma.compensation.count()).toBe(0);
    expect(await prisma.employee.count()).toBe(0);
  });

  it('restarts ids from 1 so tests can rely on predictable ids', async () => {
    await prisma.employee.create({ data: anEmployeeRow('EMP-000001', 'a@acme.example') });
    await resetDatabase(prisma);

    const second = await prisma.employee.create({
      data: anEmployeeRow('EMP-000002', 'b@acme.example'),
    });

    expect(second.id).toBe(1);
  });

  it('keeps money exact when written and read back', async () => {
    const employee = await prisma.employee.create({
      data: anEmployeeRow('EMP-000001', 'a@acme.example'),
    });

    const saved = await prisma.compensation.create({
      data: {
        employeeId: employee.id,
        amount: '0.10',
        currency: 'USD',
        effectiveDate: new Date('2024-01-01'),
      },
    });

    expect(saved.amount.toFixed(2)).toBe('0.10');
  });

  it('reports the database as reachable', async () => {
    expect(await checkDatabase(prisma)).toBe(true);
  });

  it('powers the health endpoint end to end', async () => {
    const app = createApp({ checkDatabase: () => checkDatabase(prisma) });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});

function anEmployeeRow(employeeCode: string, email: string) {
  return {
    employeeCode,
    fullName: 'Test Person',
    email,
    department: 'Engineering',
    jobTitle: 'Engineer',
    level: 'L3',
    country: 'US',
    hireDate: new Date('2020-01-01'),
  };
}
