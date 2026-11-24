/** Types shared by the API and the UI. They describe the JSON the API sends (docs/API.md section 1.3). */

export const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;
export type Level = (typeof LEVELS)[number];

export const EMPLOYMENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** The current salary. Amounts are text with two decimals, never numbers. */
export interface Compensation {
  /** Annual base salary, for example "2400000.00". */
  amount: string;
  /** ISO 4217, for example "INR". */
  currency: string;
  /** Date the amount took effect, YYYY-MM-DD. */
  effectiveDate: string;
}

export interface Employee {
  id: number;
  /** Human-friendly code, for example "EMP-000001". */
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  level: Level;
  /** ISO 3166-1 alpha-2, for example "IN". */
  country: string;
  employmentStatus: EmploymentStatus;
  /** YYYY-MM-DD. */
  hireDate: string;
  compensation: Compensation;
  /** ISO 8601 timestamp, UTC. */
  createdAt: string;
  updatedAt: string;
}

/** One entry in an employee's salary history. */
export interface CompensationChange {
  id: number;
  employeeId: number;
  /** Null for the starting salary. */
  oldAmount: string | null;
  newAmount: string;
  currency: string;
  reason: string;
  /** ISO 8601 timestamp, UTC. */
  changedAt: string;
}

/** The standard shape of every paged list. */
export interface Paged<T> {
  data: T[];
  /** Starts at 1. */
  page: number;
  pageSize: number;
  /** Number of matching records, not the number on this page. */
  total: number;
}

/** Columns the employee list can be sorted by. Anything else is refused (R-31). */
export const EMPLOYEE_SORT_COLUMNS = [
  'fullName',
  'employeeCode',
  'salary',
  'hireDate',
  'department',
  'country',
  'level',
] as const;
export type EmployeeSortColumn = (typeof EMPLOYEE_SORT_COLUMNS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * `local` keeps each salary in its own currency. `usd` converts with the fixed,
 * illustrative rates, so people paid in different currencies can be compared.
 */
export const CURRENCY_VIEWS = ['local', 'usd'] as const;
export type CurrencyView = (typeof CURRENCY_VIEWS)[number];
