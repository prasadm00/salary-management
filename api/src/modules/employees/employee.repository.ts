import type { CompensationChange, Employee, EmploymentStatus } from '@acme/shared';

/**
 * Everything the services need from storage. The real implementation talks to
 * PostgreSQL (`PrismaEmployeeRepository`). Unit tests use an in-memory copy.
 *
 * The repository holds no business rules. It only reads and writes.
 * Money amounts are text with two decimals, dates are YYYY-MM-DD text.
 */
export interface EmployeeRepository {
  /**
   * Runs `work` in one database transaction. Everything the callback does through
   * the repository it receives is saved together, or not at all if it throws.
   */
  inTransaction<T>(work: (repository: EmployeeRepository) => Promise<T>): Promise<T>;

  /** Reserves the next employee id, so the employee code can be built from it. */
  nextEmployeeId(): Promise<number>;

  /** @throws ConflictError when the email is already used */
  insertEmployee(data: NewEmployeeData): Promise<void>;
  insertCompensation(data: NewCompensationData): Promise<void>;
  insertChange(data: NewChangeData): Promise<void>;

  findById(id: number): Promise<Employee | null>;

  /** Reads the current salary and locks it until the transaction ends. Null when the employee does not exist. */
  lockCompensation(employeeId: number): Promise<CurrentCompensation | null>;
  updateCompensation(employeeId: number, amount: string, effectiveDate: string): Promise<void>;

  updateStatus(id: number, status: EmploymentStatus): Promise<void>;

  /** Salary history, newest first. */
  listChanges(
    employeeId: number,
    paging: Paging,
  ): Promise<{ rows: CompensationChange[]; total: number }>;
}

export interface Paging {
  /** Starts at 1. */
  page: number;
  pageSize: number;
}

export interface NewEmployeeData {
  id: number;
  employeeCode: string;
  fullName: string;
  /** Already lower case. */
  email: string;
  department: string;
  jobTitle: string;
  level: string;
  country: string;
  hireDate: string;
}

export interface NewCompensationData {
  employeeId: number;
  amount: string;
  currency: string;
  effectiveDate: string;
}

export interface NewChangeData {
  employeeId: number;
  /** Null for the starting salary. */
  oldAmount: string | null;
  newAmount: string;
  currency: string;
  reason: string;
  changedAt: Date;
}

export interface CurrentCompensation {
  amount: string;
  currency: string;
}
