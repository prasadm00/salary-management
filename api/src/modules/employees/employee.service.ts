import type { Employee, EmploymentStatus } from '@acme/shared';
import { toIsoDate, type Clock } from '../../domain/clock.js';
import { currencyForCountry } from '../../domain/currency.js';
import { formatEmployeeCode } from '../../domain/employeeCode.js';
import { NotFoundError, ValidationError } from '../../errors/appErrors.js';
import type { CreateEmployeeInput } from './employee.schema.js';
import type { EmployeeRepository } from './employee.repository.js';

export const INITIAL_SALARY_REASON = 'Initial salary';

/** Use cases for employees: add, look up, activate and deactivate. */
export class EmployeeService {
  constructor(
    private readonly repository: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Adds an employee with their starting salary (US-06).
   * The employee, the current salary and the starting history row are saved together.
   *
   * @throws ValidationError when the hire date is in the future (R-23)
   * @throws ConflictError when the email is already used (R-22)
   */
  async create(input: CreateEmployeeInput): Promise<Employee> {
    this.assertHireDateIsNotInTheFuture(input.hireDate);

    const currency = currencyForCountry(input.country);
    const amount = input.salary.toString();

    return this.repository.inTransaction(async (tx) => {
      const id = await tx.nextEmployeeId();

      await tx.insertEmployee({
        id,
        employeeCode: formatEmployeeCode(id),
        fullName: input.fullName,
        email: input.email,
        department: input.department,
        jobTitle: input.jobTitle,
        level: input.level,
        country: input.country,
        hireDate: input.hireDate,
      });
      await tx.insertCompensation({
        employeeId: id,
        amount,
        currency,
        effectiveDate: input.hireDate,
      });
      await tx.insertChange({
        employeeId: id,
        oldAmount: null,
        newAmount: amount,
        currency,
        reason: INITIAL_SALARY_REASON,
        changedAt: this.clock.now(),
      });

      const created = await tx.findById(id);
      if (!created) throw new Error(`Employee ${id} was not found right after it was saved.`);
      return created;
    });
  }

  /** @throws NotFoundError when no employee has this id */
  async get(id: number): Promise<Employee> {
    const employee = await this.repository.findById(id);
    if (!employee) throw new NotFoundError('Employee not found.');
    return employee;
  }

  /**
   * Marks an employee active or inactive (US-09). Employees are never deleted.
   * Setting the status they already have changes nothing.
   *
   * @throws NotFoundError when no employee has this id
   */
  async setStatus(id: number, status: EmploymentStatus): Promise<Employee> {
    const employee = await this.get(id);
    if (employee.employmentStatus === status) return employee;

    await this.repository.updateStatus(id, status);
    return this.get(id);
  }

  private assertHireDateIsNotInTheFuture(hireDate: string): void {
    const today = toIsoDate(this.clock.now());
    if (hireDate > today) {
      throw new ValidationError('Some fields are invalid.', [
        { field: 'hireDate', message: 'Hire date cannot be in the future.' },
      ]);
    }
  }
}
