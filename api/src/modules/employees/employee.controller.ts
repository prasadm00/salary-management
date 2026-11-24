import type { Request, Response } from 'express';
import type { EmployeeService } from './employee.service.js';
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  updateStatusSchema,
} from './employee.schema.js';

/**
 * Turns HTTP requests into service calls and results into HTTP responses.
 * No business rules here. Errors thrown below are turned into responses by the error handler.
 */
export function createEmployeeController(service: EmployeeService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      // A request without a body has `req.body === undefined`, which should list the missing fields.
      const input = createEmployeeSchema.parse(req.body ?? {});
      const employee = await service.create(input);
      res.status(201).location(`/api/employees/${employee.id}`).json(employee);
    },

    get: async (req: Request, res: Response): Promise<void> => {
      const { id } = employeeIdParamSchema.parse(req.params);
      res.json(await service.get(id));
    },

    updateStatus: async (req: Request, res: Response): Promise<void> => {
      const { id } = employeeIdParamSchema.parse(req.params);
      const { status } = updateStatusSchema.parse(req.body ?? {});
      res.json(await service.setStatus(id, status));
    },
  };
}
