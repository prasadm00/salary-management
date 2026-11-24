import type { Request, Response } from 'express';
import { employeeListQuerySchema } from './employeeList.schema.js';
import type { EmployeeQueryService } from './employeeQuery.service.js';

/** HTTP in and out only. */
export function createEmployeeQueryController(service: EmployeeQueryService) {
  return {
    list: async (req: Request, res: Response): Promise<void> => {
      const query = employeeListQuerySchema.parse(req.query);
      res.json(await service.list(query));
    },
  };
}
