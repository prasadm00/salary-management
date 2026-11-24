import type { CompensationChange, Employee, FilterOptions, Paged } from '@acme/shared';

/** An employee as the API sends it. Change only what a test cares about. */
export function anEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employeeCode: 'EMP-000001',
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    department: 'Engineering',
    jobTitle: 'Senior Engineer',
    level: 'L3',
    country: 'IN',
    employmentStatus: 'ACTIVE',
    hireDate: '2021-04-12',
    compensation: { amount: '2400000.00', currency: 'INR', effectiveDate: '2025-04-01' },
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
    ...overrides,
  };
}

/** A page of a list, in the shape the API sends. */
export function aPage<T>(data: T[], overrides: Partial<Paged<T>> = {}): Paged<T> {
  return { data, page: 1, pageSize: 25, total: data.length, ...overrides };
}

/** One entry of a salary history. */
export function aChange(overrides: Partial<CompensationChange> = {}): CompensationChange {
  return {
    id: 1,
    employeeId: 1,
    oldAmount: null,
    newAmount: '2000000.00',
    currency: 'INR',
    reason: 'Initial salary',
    changedAt: '2021-04-12T00:00:00.000Z',
    ...overrides,
  };
}

/** The choices the filter dropdowns offer. */
export const FILTER_OPTIONS: FilterOptions = {
  countries: [
    { code: 'IN', name: 'India', currency: 'INR' },
    { code: 'US', name: 'United States', currency: 'USD' },
  ],
  currencies: ['INR', 'USD'],
  departments: ['Engineering', 'Sales'],
  levels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'],
  statuses: ['ACTIVE', 'INACTIVE'],
  ratesAsOf: '2026-01-01',
};
