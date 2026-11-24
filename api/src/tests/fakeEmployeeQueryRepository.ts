import type { Employee } from '@acme/shared';
import type { EmployeeQueryRepository } from '../modules/employees/employeeQuery.repository.js';
import type { ListEmployeesQuery } from '../modules/employees/employeeList.schema.js';

/**
 * A stand-in for the database search, for unit tests of the services.
 * It returns what the test gives it and remembers what it was asked.
 * The real filtering and sorting is tested against PostgreSQL, not here.
 */
export class FakeEmployeeQueryRepository implements EmployeeQueryRepository {
  lastQuery: ListEmployeesQuery | undefined;
  calls = 0;

  constructor(
    private readonly page: { rows: Employee[]; total: number } = { rows: [], total: 0 },
    private readonly countries: string[] = [],
    private readonly departments: string[] = [],
  ) {}

  findPage(query: ListEmployeesQuery): Promise<{ rows: Employee[]; total: number }> {
    this.calls += 1;
    this.lastQuery = query;
    return Promise.resolve(this.page);
  }

  distinctCountries(): Promise<string[]> {
    return Promise.resolve(this.countries);
  }

  distinctDepartments(): Promise<string[]> {
    return Promise.resolve(this.departments);
  }
}
