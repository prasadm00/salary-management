import type { Clock } from './domain/clock.js';
import type { PrismaClient } from './db/prisma.js';
import { CompensationService } from './modules/compensation/compensation.service.js';
import { EmployeeService } from './modules/employees/employee.service.js';
import { PrismaEmployeeRepository } from './modules/employees/prismaEmployeeRepository.js';

/** Where the real parts are wired together. Tests use this too, with a fixed clock. */
export function createServices(prisma: PrismaClient, clock: Clock) {
  const repository = new PrismaEmployeeRepository(prisma);

  return {
    employeeService: new EmployeeService(repository, clock),
    compensationService: new CompensationService(repository, clock),
  };
}

export type Services = ReturnType<typeof createServices>;
