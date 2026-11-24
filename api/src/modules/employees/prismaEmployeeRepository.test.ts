import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '../../errors/appErrors.js';
import { createTestPrisma, resetDatabase } from '../../tests/testDatabase.js';
import type { NewEmployeeData } from './employee.repository.js';
import { PrismaEmployeeRepository } from './prismaEmployeeRepository.js';

const prisma = createTestPrisma();
const repository = new PrismaEmployeeRepository(prisma);

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

function anEmployee(overrides: Partial<NewEmployeeData> = {}): NewEmployeeData {
  return {
    id: 1,
    employeeCode: 'EMP-000001',
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    level: 'L3',
    country: 'IN',
    hireDate: '2021-04-12',
    ...overrides,
  };
}

async function saveEmployeeWithSalary(overrides: Partial<NewEmployeeData> = {}) {
  const employee = anEmployee(overrides);
  await repository.insertEmployee(employee);
  await repository.insertCompensation({
    employeeId: employee.id,
    amount: '2000000.00',
    currency: 'INR',
    effectiveDate: '2021-04-12',
  });
  return employee;
}

describe('PrismaEmployeeRepository', () => {
  describe('unique violations (R-22)', () => {
    it('reports a repeated email as a conflict on the email field', async () => {
      await repository.insertEmployee(anEmployee());

      const attempt = repository.insertEmployee(anEmployee({ id: 2, employeeCode: 'EMP-000002' }));

      await expect(attempt).rejects.toThrowError(ConflictError);
      await expect(attempt).rejects.toMatchObject({
        message: 'An employee with this email already exists.',
        details: [{ field: 'email', message: 'This email is already used.' }],
      });
    });

    it('reports a repeated employee code as a conflict on the employeeCode field, not the email', async () => {
      await repository.insertEmployee(anEmployee());

      const attempt = repository.insertEmployee(anEmployee({ id: 2, email: 'other@acme.example' }));

      await expect(attempt).rejects.toMatchObject({
        message: 'An employee with this code already exists.',
        details: [{ field: 'employeeCode', message: 'This employee code is already used.' }],
      });
    });
  });

  describe('nextEmployeeId', () => {
    it('hands out 1, 2, 3 in order and never repeats an id', async () => {
      const ids = [
        await repository.nextEmployeeId(),
        await repository.nextEmployeeId(),
        await repository.nextEmployeeId(),
      ];

      expect(ids).toEqual([1, 2, 3]);
    });

    it('never hands the same id to two callers at once', async () => {
      const ids = await Promise.all(Array.from({ length: 10 }, () => repository.nextEmployeeId()));

      expect(new Set(ids).size).toBe(10);
    });
  });

  describe('findById', () => {
    it('returns null for an unknown id', async () => {
      expect(await repository.findById(404)).toBeNull();
    });

    it('returns dates as YYYY-MM-DD and money as text with two decimals', async () => {
      await saveEmployeeWithSalary();

      const employee = await repository.findById(1);

      expect(employee).toMatchObject({
        hireDate: '2021-04-12',
        compensation: { amount: '2000000.00', currency: 'INR', effectiveDate: '2021-04-12' },
      });
    });
  });

  describe('lockCompensation', () => {
    it('reads the current salary as exact text', async () => {
      await saveEmployeeWithSalary();

      expect(await repository.lockCompensation(1)).toEqual({
        amount: '2000000.00',
        currency: 'INR',
      });
    });

    it('returns null when the employee does not exist', async () => {
      expect(await repository.lockCompensation(404)).toBeNull();
    });
  });

  describe('inTransaction', () => {
    it('saves everything when the work finishes', async () => {
      await repository.inTransaction(async (tx) => {
        await tx.insertEmployee(anEmployee());
        await tx.insertCompensation({
          employeeId: 1,
          amount: '10.00',
          currency: 'INR',
          effectiveDate: '2021-04-12',
        });
      });

      expect(await prisma.employee.count()).toBe(1);
      expect(await prisma.compensation.count()).toBe(1);
    });

    it('saves nothing when the work throws part way through', async () => {
      const attempt = repository.inTransaction(async (tx) => {
        await tx.insertEmployee(anEmployee());
        await tx.insertCompensation({
          employeeId: 1,
          amount: '10.00',
          currency: 'INR',
          effectiveDate: '2021-04-12',
        });
        throw new Error('something broke after two writes');
      });

      await expect(attempt).rejects.toThrowError('something broke');
      expect(await prisma.employee.count()).toBe(0);
      expect(await prisma.compensation.count()).toBe(0);
    });

    it('lets a nested call join the same transaction instead of starting another', async () => {
      const attempt = repository.inTransaction(async (outer) => {
        await outer.inTransaction((inner) => inner.insertEmployee(anEmployee()));
        throw new Error('outer fails after inner finished');
      });

      await expect(attempt).rejects.toThrowError('outer fails');
      expect(await prisma.employee.count()).toBe(0);
    });
  });
});
