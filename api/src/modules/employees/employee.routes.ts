import { Router } from 'express';
import { createEmployeeController } from './employee.controller.js';
import type { EmployeeService } from './employee.service.js';

/** Mounted at /api/employees. */
export function createEmployeeRouter(service: EmployeeService): Router {
  const router = Router();
  const controller = createEmployeeController(service);

  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id/status', controller.updateStatus);

  return router;
}
