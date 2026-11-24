import { Money } from '../domain/money.js';
import type { CreateEmployeeInput } from '../modules/employees/employee.schema.js';

/** A valid request body for POST /api/employees. Override only what a test cares about. */
export function aNewEmployeeBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    level: 'L3',
    country: 'IN',
    hireDate: '2021-04-12',
    salary: '2000000.00',
    ...overrides,
  };
}

/** The same employee after validation, as the service receives it. */
export function aCreateEmployeeInput(
  overrides: Partial<CreateEmployeeInput> = {},
): CreateEmployeeInput {
  return {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    level: 'L3',
    country: 'IN',
    hireDate: '2021-04-12',
    salary: Money.parse('2000000.00'),
    ...overrides,
  };
}
