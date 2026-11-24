import type { CompensationChange, Employee, EmploymentStatus, Level } from '@acme/shared';
import { ConflictError } from '../errors/appErrors.js';
import type {
  CurrentCompensation,
  EmployeeRepository,
  NewChangeData,
  NewCompensationData,
  NewEmployeeData,
  Paging,
} from '../modules/employees/employee.repository.js';

/**
 * A repository that keeps everything in memory, for fast unit tests of the services.
 * It mirrors the rules of the real database that matter to the services (unique email).
 */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private employees = new Map<number, NewEmployeeData & { status: EmploymentStatus }>();
  private compensations = new Map<number, NewCompensationData>();
  private changes: CompensationChange[] = [];
  private lastId = 0;
  private lastChangeId = 0;

  /** Everything saved in the history table, oldest first. Handy for assertions. */
  get savedChanges(): readonly CompensationChange[] {
    return this.changes;
  }

  get employeeCount(): number {
    return this.employees.size;
  }

  inTransaction<T>(work: (repository: EmployeeRepository) => Promise<T>): Promise<T> {
    return work(this);
  }

  nextEmployeeId(): Promise<number> {
    this.lastId += 1;
    return Promise.resolve(this.lastId);
  }

  insertEmployee(data: NewEmployeeData): Promise<void> {
    const emailTaken = [...this.employees.values()].some((row) => row.email === data.email);
    if (emailTaken) {
      return Promise.reject(
        new ConflictError('An employee with this email already exists.', [
          { field: 'email', message: 'This email is already used.' },
        ]),
      );
    }
    this.employees.set(data.id, { ...data, status: 'ACTIVE' });
    return Promise.resolve();
  }

  insertCompensation(data: NewCompensationData): Promise<void> {
    this.compensations.set(data.employeeId, { ...data });
    return Promise.resolve();
  }

  insertChange(data: NewChangeData): Promise<void> {
    this.lastChangeId += 1;
    this.changes.push({
      id: this.lastChangeId,
      employeeId: data.employeeId,
      oldAmount: data.oldAmount,
      newAmount: data.newAmount,
      currency: data.currency,
      reason: data.reason,
      changedAt: data.changedAt.toISOString(),
    });
    return Promise.resolve();
  }

  findById(id: number): Promise<Employee | null> {
    const row = this.employees.get(id);
    const compensation = this.compensations.get(id);
    if (!row || !compensation) return Promise.resolve(null);

    return Promise.resolve({
      id: row.id,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      email: row.email,
      department: row.department,
      jobTitle: row.jobTitle,
      level: row.level as Level,
      country: row.country,
      employmentStatus: row.status,
      hireDate: row.hireDate,
      compensation: {
        amount: compensation.amount,
        currency: compensation.currency,
        effectiveDate: compensation.effectiveDate,
      },
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: '2026-11-01T09:00:00.000Z',
    });
  }

  lockCompensation(employeeId: number): Promise<CurrentCompensation | null> {
    const compensation = this.compensations.get(employeeId);
    if (!compensation) return Promise.resolve(null);
    return Promise.resolve({ amount: compensation.amount, currency: compensation.currency });
  }

  updateCompensation(employeeId: number, amount: string, effectiveDate: string): Promise<void> {
    const compensation = this.compensations.get(employeeId);
    if (compensation)
      this.compensations.set(employeeId, { ...compensation, amount, effectiveDate });
    return Promise.resolve();
  }

  updateStatus(id: number, status: EmploymentStatus): Promise<void> {
    const row = this.employees.get(id);
    if (row) this.employees.set(id, { ...row, status });
    return Promise.resolve();
  }

  listChanges(
    employeeId: number,
    paging: Paging,
  ): Promise<{ rows: CompensationChange[]; total: number }> {
    const all = this.changes
      .filter((change) => change.employeeId === employeeId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt) || b.id - a.id);
    const start = (paging.page - 1) * paging.pageSize;
    return Promise.resolve({ rows: all.slice(start, start + paging.pageSize), total: all.length });
  }
}
