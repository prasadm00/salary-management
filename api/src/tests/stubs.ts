import type { CompensationService } from '../modules/compensation/compensation.service.js';
import type { EmployeeQueryService } from '../modules/employees/employeeQuery.service.js';
import type { AnalyticsService } from '../modules/analytics/analytics.service.js';
import type { MetaService } from '../modules/meta/meta.service.js';
import type { EmployeeService } from '../modules/employees/employee.service.js';
import type { Services } from '../composition.js';

/**
 * Stand-ins for tests that never touch the employee routes (health, error handling).
 * Using one of them would fail loudly, because every method is missing.
 */
export const unusedServices: Services = {
  employeeService: {} as unknown as EmployeeService,
  compensationService: {} as unknown as CompensationService,
  employeeQueryService: {} as unknown as EmployeeQueryService,
  metaService: {} as unknown as MetaService,
  analyticsService: {} as unknown as AnalyticsService,
};
