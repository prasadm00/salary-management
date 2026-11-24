import type { CompensationChange, Employee, Paged } from '@acme/shared';
import { toIsoDate, type Clock } from '../../domain/clock.js';
import { Money } from '../../domain/money.js';
import { validateSalaryChange } from '../../domain/salaryChange.js';
import { NotFoundError } from '../../errors/appErrors.js';
import type { EmployeeRepository, Paging } from '../employees/employee.repository.js';
import type { ChangeSalaryInput } from './compensation.schema.js';

/** Use cases for pay: change a salary, and read its history. */
export class CompensationService {
  constructor(
    private readonly repository: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Changes an employee's salary and records why (US-07).
   *
   * The current salary is locked first, so two changes made at the same moment run one
   * after the other and the history has no gaps. The new salary and its history row are
   * saved together, or not at all (R-10).
   *
   * @throws NotFoundError when the employee does not exist
   * @throws ValidationError when the reason is missing, too short or too long (R-08)
   * @throws BusinessRuleError when the amount did not change (R-07)
   */
  async changeSalary(employeeId: number, input: ChangeSalaryInput): Promise<Employee> {
    return this.repository.inTransaction(async (tx) => {
      const current = await tx.lockCompensation(employeeId);
      if (!current) throw new NotFoundError('Employee not found.');

      const change = validateSalaryChange({
        currentAmount: Money.parse(current.amount),
        newAmount: input.amount,
        reason: input.reason,
      });

      const now = this.clock.now();
      const newAmount = change.newAmount.toString();

      await tx.updateCompensation(employeeId, newAmount, toIsoDate(now));
      await tx.insertChange({
        employeeId,
        oldAmount: current.amount,
        newAmount,
        // The currency of an existing salary never changes (R-09).
        currency: current.currency,
        reason: change.reason,
        changedAt: now,
      });

      const updated = await tx.findById(employeeId);
      if (!updated) throw new Error(`Employee ${employeeId} disappeared during a salary change.`);
      return updated;
    });
  }

  /**
   * An employee's salary history, newest first (US-08). The first entry is the starting salary.
   * @throws NotFoundError when the employee does not exist
   */
  async history(employeeId: number, paging: Paging): Promise<Paged<CompensationChange>> {
    const employee = await this.repository.findById(employeeId);
    if (!employee) throw new NotFoundError('Employee not found.');

    const { rows, total } = await this.repository.listChanges(employeeId, paging);
    return { data: rows, page: paging.page, pageSize: paging.pageSize, total };
  }
}
