import type { Employee } from '@acme/shared';
import type { ListEmployeesQuery } from './employeeList.schema.js';

/**
 * Read-only searching of employees. The PostgreSQL implementation does all the
 * filtering, sorting and counting in the database, so the 10,000 rows never reach the server.
 * It holds no business rules.
 */
export interface EmployeeQueryRepository {
  /**
   * One page of employees that match the query, in the requested order, and the
   * total number of matches across all pages. The order always ends with the id,
   * so paging never repeats or skips anyone (R-33).
   */
  findPage(query: ListEmployeesQuery): Promise<{ rows: Employee[]; total: number }>;

  /** Country codes that at least one employee has, in no particular order. */
  distinctCountries(): Promise<string[]>;

  /** Departments that at least one employee has, in no particular order. */
  distinctDepartments(): Promise<string[]>;
}
