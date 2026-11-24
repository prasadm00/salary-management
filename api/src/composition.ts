import type { Clock } from './domain/clock.js';
import type { PrismaClient } from './db/prisma.js';
import { CompensationService } from './modules/compensation/compensation.service.js';
import { EmployeeService } from './modules/employees/employee.service.js';
import { EmployeeQueryService } from './modules/employees/employeeQuery.service.js';
import { MetaService } from './modules/meta/meta.service.js';
import { PrismaEmployeeQueryRepository } from './modules/employees/prismaEmployeeQueryRepository.js';
import { PrismaEmployeeRepository } from './modules/employees/prismaEmployeeRepository.js';

/** Where the real parts are wired together. Tests use this too, with a fixed clock. */
export function createServices(prisma: PrismaClient, clock: Clock) {
  const repository = new PrismaEmployeeRepository(prisma);
  const queryRepository = new PrismaEmployeeQueryRepository(prisma);

  return {
    employeeService: new EmployeeService(repository, clock),
    compensationService: new CompensationService(repository, clock),
    employeeQueryService: new EmployeeQueryService(queryRepository),
    metaService: new MetaService(queryRepository),
  };
}

export type Services = ReturnType<typeof createServices>;
