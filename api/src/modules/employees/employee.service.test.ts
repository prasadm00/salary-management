import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../../domain/money.js';
import { NotFoundError, ValidationError } from '../../errors/appErrors.js';
import { aCreateEmployeeInput } from '../../tests/builders.js';
import { fixedClock, TEST_NOW } from '../../tests/fixedClock.js';
import { InMemoryEmployeeRepository } from '../../tests/inMemoryEmployeeRepository.js';
import { EmployeeService } from './employee.service.js';

let repository: InMemoryEmployeeRepository;
let service: EmployeeService;

beforeEach(() => {
  repository = new InMemoryEmployeeRepository();
  service = new EmployeeService(repository, fixedClock());
});

describe('EmployeeService.create', () => {
  it('creates an active employee with a generated code, and the salary as the current compensation', async () => {
    const employee = await service.create(aCreateEmployeeInput());

    expect(employee).toMatchObject({
      id: 1,
      employeeCode: 'EMP-000001',
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      employmentStatus: 'ACTIVE',
      compensation: { amount: '2000000.00', currency: 'INR', effectiveDate: '2021-04-12' },
    });
  });

  it('R-25: gives each new employee the next code', async () => {
    await service.create(aCreateEmployeeInput());

    const second = await service.create(aCreateEmployeeInput({ email: 'second@acme.example' }));

    expect(second.employeeCode).toBe('EMP-000002');
  });

  it('R-06: takes the currency from the country, the caller cannot choose it', async () => {
    const us = await service.create(
      aCreateEmployeeInput({ country: 'US', email: 'a@acme.example' }),
    );
    const de = await service.create(
      aCreateEmployeeInput({ country: 'DE', email: 'b@acme.example' }),
    );
    const jp = await service.create(
      aCreateEmployeeInput({ country: 'JP', email: 'c@acme.example' }),
    );

    expect([us, de, jp].map((employee) => employee.compensation.currency)).toEqual([
      'USD',
      'EUR',
      'JPY',
    ]);
  });

  it('R-11: writes a starting history row with no old amount and the reason "Initial salary"', async () => {
    const employee = await service.create(aCreateEmployeeInput());

    expect(repository.savedChanges).toEqual([
      {
        id: 1,
        employeeId: employee.id,
        oldAmount: null,
        newAmount: '2000000.00',
        currency: 'INR',
        reason: 'Initial salary',
        changedAt: TEST_NOW,
      },
    ]);
  });

  it('keeps the salary exact to the cent', async () => {
    const employee = await service.create(aCreateEmployeeInput({ salary: Money.parse('0.10') }));

    expect(employee.compensation.amount).toBe('0.10');
  });

  describe('R-23: the hire date cannot be in the future', () => {
    it('accepts today', async () => {
      const employee = await service.create(aCreateEmployeeInput({ hireDate: '2026-11-01' }));

      expect(employee.hireDate).toBe('2026-11-01');
    });

    it('rejects tomorrow and saves nothing', async () => {
      const attempt = service.create(aCreateEmployeeInput({ hireDate: '2026-11-02' }));

      await expect(attempt).rejects.toThrowError(ValidationError);
      await expect(attempt).rejects.toMatchObject({
        details: [{ field: 'hireDate', message: 'Hire date cannot be in the future.' }],
      });
      expect(repository.employeeCount).toBe(0);
      expect(repository.savedChanges).toHaveLength(0);
    });
  });
});

describe('EmployeeService.get', () => {
  it('returns the employee', async () => {
    const created = await service.create(aCreateEmployeeInput());

    expect(await service.get(created.id)).toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(service.get(999)).rejects.toThrowError(NotFoundError);
    await expect(service.get(999)).rejects.toThrowError('Employee not found.');
  });
});

describe('EmployeeService.setStatus', () => {
  it('deactivates an employee and keeps them findable', async () => {
    const created = await service.create(aCreateEmployeeInput());

    const updated = await service.setStatus(created.id, 'INACTIVE');

    expect(updated.employmentStatus).toBe('INACTIVE');
    expect((await service.get(created.id)).employmentStatus).toBe('INACTIVE');
  });

  it('can reactivate an employee', async () => {
    const created = await service.create(aCreateEmployeeInput());
    await service.setStatus(created.id, 'INACTIVE');

    const updated = await service.setStatus(created.id, 'ACTIVE');

    expect(updated.employmentStatus).toBe('ACTIVE');
  });

  it('setting the same status again is allowed and changes nothing', async () => {
    const created = await service.create(aCreateEmployeeInput());

    const updated = await service.setStatus(created.id, 'ACTIVE');

    expect(updated).toEqual(created);
  });

  it('does not touch salary or history', async () => {
    const created = await service.create(aCreateEmployeeInput());

    const updated = await service.setStatus(created.id, 'INACTIVE');

    expect(updated.compensation).toEqual(created.compensation);
    expect(repository.savedChanges).toHaveLength(1);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(service.setStatus(999, 'INACTIVE')).rejects.toThrowError(NotFoundError);
  });
});
