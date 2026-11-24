import { Router } from 'express';
import { createCompensationController } from './compensation.controller.js';
import type { CompensationService } from './compensation.service.js';

/**
 * Pay routes. Mounted at /api/employees, next to the employee routes.
 * There is deliberately no route that edits or deletes history (R-12).
 */
export function createCompensationRouter(service: CompensationService): Router {
  const router = Router();
  const controller = createCompensationController(service);

  router.patch('/:id/compensation', controller.changeSalary);
  router.get('/:id/compensation-history', controller.history);

  return router;
}
