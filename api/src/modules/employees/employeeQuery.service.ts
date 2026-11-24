import type { Employee, Paged } from '@acme/shared';
import { ValidationError } from '../../errors/appErrors.js';
import type { ListEmployeesQuery } from './employeeList.schema.js';
import type { EmployeeQueryRepository } from './employeeQuery.repository.js';

/** Use cases for finding employees: search, filter, sort and page (US-01 to US-04). */
export class EmployeeQueryService {
  constructor(private readonly repository: EmployeeQueryRepository) {}

  /**
   * One page of employees.
   *
   * R-32: sorting by salary is refused unless the people shown are paid in one currency
   * (a `currency` filter) or the USD view is on, because 10,000 INR and 10,000 USD cannot
   * be put in order by their amounts.
   *
   * @throws ValidationError when sorting by salary across currencies
   */
  async list(query: ListEmployeesQuery): Promise<Paged<Employee>> {
    assertSalarySortIsComparable(query);

    const { rows, total } = await this.repository.findPage(query);
    return { data: rows, page: query.page, pageSize: query.pageSize, total };
  }
}

function assertSalarySortIsComparable(query: ListEmployeesQuery): void {
  const comparable = query.currency !== undefined || query.view === 'usd';
  if (query.sortBy === 'salary' && !comparable) {
    throw new ValidationError('Some fields are invalid.', [
      {
        field: 'sortBy',
        message: 'Choose a currency or switch to the USD view to sort by salary.',
      },
    ]);
  }
}
