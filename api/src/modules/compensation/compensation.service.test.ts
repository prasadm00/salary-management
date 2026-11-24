import type { Employee } from '@acme/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../../domain/money.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../errors/appErrors.js';
import { aCreateEmployeeInput } from '../../tests/builders.js';
import { fixedClock, movableClock, TEST_NOW } from '../../tests/fixedClock.js';
import { InMemoryEmployeeRepository } from '../../tests/inMemoryEmployeeRepository.js';
import { EmployeeService } from '../employees/employee.service.js';
import { CompensationService } from './compensation.service.js';

let repository: InMemoryEmployeeRepository;
let employee: Employee;
let service: CompensationService;

beforeEach(async () => {
  repository = new InMemoryEmployeeRepository();
  employee = await new EmployeeService(repository, fixedClock()).create(aCreateEmployeeInput());
  service = new CompensationService(repository, fixedClock());
});

/** Passing `undefined` as the reason really sends no reason (a default value would hide that). */
const change = (amount: string, ...reason: [reason?: unknown]) => ({
  amount: Money.parse(amount),
  reason: reason.length > 0 ? reason[0] : 'Annual review 2026',
});

describe('CompensationService.changeSalary', () => {
  it('updates the current salary and returns the updated employee', async () => {
    const updated = await service.changeSalary(employee.id, change('2400000.00'));

    expect(updated.compensation).toEqual({
      amount: '2400000.00',
      currency: 'INR',
      effectiveDate: '2026-11-01',
    });
    expect(
      (await new EmployeeService(repository, fixedClock()).get(employee.id)).compensation.amount,
    ).toBe('2400000.00');
  });

  it('records the old and new amount, currency, reason and time in the history', async () => {
    await service.changeSalary(employee.id, change('2400000.00', 'Promotion to L4'));

    expect(repository.savedChanges.at(-1)).toMatchObject({
      employeeId: employee.id,
      oldAmount: '2000000.00',
      newAmount: '2400000.00',
      currency: 'INR',
      reason: 'Promotion to L4',
      changedAt: TEST_NOW,
    });
  });

  it('keeps the starting history row and adds one new row', async () => {
    await service.changeSalary(employee.id, change('2400000.00'));

    expect(repository.savedChanges.map((row) => [row.oldAmount, row.newAmount])).toEqual([
      [null, '2000000.00'],
      ['2000000.00', '2400000.00'],
    ]);
  });

  it('stores the reason without surrounding spaces', async () => {
    await service.changeSalary(employee.id, change('2400000.00', '  Market adjustment  '));

    expect(repository.savedChanges.at(-1)?.reason).toBe('Market adjustment');
  });

  it('chains changes: each old amount is the previous new amount', async () => {
    await service.changeSalary(employee.id, change('2100000.00'));
    await service.changeSalary(employee.id, change('2300000.50'));

    expect(repository.savedChanges.slice(1).map((row) => [row.oldAmount, row.newAmount])).toEqual([
      ['2000000.00', '2100000.00'],
      ['2100000.00', '2300000.50'],
    ]);
  });

  it('allows a decrease', async () => {
    const updated = await service.changeSalary(employee.id, change('1900000.00', 'Role change'));

    expect(updated.compensation.amount).toBe('1900000.00');
  });

  it('uses the date from the clock as the effective date', async () => {
    const clock = movableClock('2027-03-15T10:00:00.000Z');
    const later = new CompensationService(repository, clock);

    const updated = await later.changeSalary(employee.id, change('2400000.00'));

    expect(updated.compensation.effectiveDate).toBe('2027-03-15');
  });

  it('R-07: refuses an unchanged amount and writes nothing', async () => {
    const attempt = service.changeSalary(employee.id, change('2000000'));

    await expect(attempt).rejects.toThrowError(BusinessRuleError);
    expect(repository.savedChanges).toHaveLength(1);
    expect(
      (await new EmployeeService(repository, fixedClock()).get(employee.id)).compensation.amount,
    ).toBe('2000000.00');
  });

  it.each([undefined, '', '   ', 'ab'])(
    'R-08: refuses the reason %j and writes nothing',
    async (reason) => {
      const attempt = service.changeSalary(employee.id, change('2400000.00', reason));

      await expect(attempt).rejects.toThrowError(ValidationError);
      expect(repository.savedChanges).toHaveLength(1);
    },
  );

  it('throws NotFoundError for an unknown employee', async () => {
    const attempt = service.changeSalary(999, change('2400000.00'));

    await expect(attempt).rejects.toThrowError(NotFoundError);
    await expect(attempt).rejects.toThrowError('Employee not found.');
  });
});

describe('CompensationService.history', () => {
  it('returns the starting salary as the first entry', async () => {
    const page = await service.history(employee.id, { page: 1, pageSize: 25 });

    expect(page).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    expect(page.data[0]).toMatchObject({
      oldAmount: null,
      newAmount: '2000000.00',
      reason: 'Initial salary',
    });
  });

  it('returns the newest entry first', async () => {
    const clock = movableClock();
    const timed = new CompensationService(repository, clock);
    clock.set('2026-12-01T09:00:00.000Z');
    await timed.changeSalary(employee.id, change('2100000.00', 'First raise'));
    clock.set('2027-01-01T09:00:00.000Z');
    await timed.changeSalary(employee.id, change('2200000.00', 'Second raise'));

    const page = await service.history(employee.id, { page: 1, pageSize: 25 });

    expect(page.data.map((row) => row.reason)).toEqual([
      'Second raise',
      'First raise',
      'Initial salary',
    ]);
  });

  it('pages through the entries and reports the total', async () => {
    for (const amount of ['2100000.00', '2200000.00', '2300000.00']) {
      await service.changeSalary(employee.id, change(amount, `Raise to ${amount}`));
    }

    const second = await service.history(employee.id, { page: 2, pageSize: 2 });

    expect(second.total).toBe(4);
    expect(second.data).toHaveLength(2);
  });

  it('returns an empty list, with the right total, for a page past the end', async () => {
    const page = await service.history(employee.id, { page: 9, pageSize: 25 });

    expect(page).toEqual({ data: [], page: 9, pageSize: 25, total: 1 });
  });

  it('throws NotFoundError for an unknown employee', async () => {
    await expect(service.history(999, { page: 1, pageSize: 25 })).rejects.toThrowError(
      NotFoundError,
    );
  });
});
