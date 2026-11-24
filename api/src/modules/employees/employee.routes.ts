import { Router } from 'express';
import { createEmployeeController } from './employee.controller.js';
import type { EmployeeService } from './employee.service.js';
import { createEmployeeQueryController } from './employeeQuery.controller.js';
import type { EmployeeQueryService } from './employeeQuery.service.js';

/** Mounted at /api/employees. */
export function createEmployeeRouter(
  service: EmployeeService,
  queryService: EmployeeQueryService,
): Router {
  const router = Router();
  const controller = createEmployeeController(service);
  const queryController = createEmployeeQueryController(queryService);

  router.get('/', queryController.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id/status', controller.updateStatus);

  return router;
}
