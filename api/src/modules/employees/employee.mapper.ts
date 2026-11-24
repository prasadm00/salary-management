import type { Employee, EmploymentStatus, Level } from '@acme/shared';
import type { Prisma } from '../../generated/prisma/client.js';

/** An employee row as the database returns it, with the current salary attached. */
export type EmployeeWithCompensation = Prisma.EmployeeGetPayload<{
  include: { compensation: true };
}>;

/** "2021-04-12" as a UTC midnight date, which PostgreSQL stores in a DATE column as-is. */
export function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Turns a database row into the JSON shape of the API (docs/API.md section 1.3). */
export function toEmployee(row: EmployeeWithCompensation): Employee {
  if (!row.compensation) {
    // Every employee is created together with a salary, so this means the data is damaged.
    throw new Error(`Employee ${row.id} has no compensation row.`);
  }

  return {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    email: row.email,
    department: row.department,
    jobTitle: row.jobTitle,
    // The database CHECK constraints guarantee these values.
    level: row.level as Level,
    country: row.country,
    employmentStatus: row.employmentStatus as EmploymentStatus,
    hireDate: row.hireDate.toISOString().slice(0, 10),
    compensation: {
      amount: row.compensation.amount.toFixed(2),
      currency: row.compensation.currency,
      effectiveDate: row.compensation.effectiveDate.toISOString().slice(0, 10),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
