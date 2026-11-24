import type { Request, Response } from 'express';
import { pagingQuerySchema } from '../../validation/pagination.js';
import { employeeIdParamSchema } from '../employees/employee.schema.js';
import { changeSalarySchema } from './compensation.schema.js';
import type { CompensationService } from './compensation.service.js';

/** HTTP in and out only. The rules live in the service and the domain. */
export function createCompensationController(service: CompensationService) {
  return {
    changeSalary: async (req: Request, res: Response): Promise<void> => {
      const { id } = employeeIdParamSchema.parse(req.params);
      const input = changeSalarySchema.parse(req.body ?? {});
      res.json(await service.changeSalary(id, input));
    },

    history: async (req: Request, res: Response): Promise<void> => {
      const { id } = employeeIdParamSchema.parse(req.params);
      const paging = pagingQuerySchema.parse(req.query);
      res.json(await service.history(id, paging));
    },
  };
}
