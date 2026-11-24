import { USD_PER_UNIT, type Employee, type EmployeeSortColumn } from '@acme/shared';
import { containsPattern } from '../../db/likePattern.js';
import type { PrismaClient } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { ListEmployeesQuery } from './employeeList.schema.js';
import { toEmployee } from './employee.mapper.js';
import type { EmployeeQueryRepository } from './employeeQuery.repository.js';

/**
 * R-31: the SQL for each sort column. Text from the request never becomes SQL.
 * The request is checked against the allow-list first, and only then is this table
 * consulted, so every fragment below is written here, in code, by us.
 *
 * Names and departments are lower-cased so the order does not depend on how the
 * database was set up (its locale), which keeps results the same on every machine.
 */
const SORT_SQL: Record<Exclude<EmployeeSortColumn, 'salary'>, string> = {
  fullName: 'lower(e.full_name)',
  employeeCode: 'e.employee_code',
  hireDate: 'e.hire_date',
  department: 'lower(e.department)',
  country: 'e.country',
  level: 'e.level',
};

const FROM_EMPLOYEES = Prisma.sql`FROM employees e JOIN compensations c ON c.employee_id = e.id`;

/** The PostgreSQL implementation. Every value is sent as a parameter, never joined into the SQL text. */
export class PrismaEmployeeQueryRepository implements EmployeeQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPage(query: ListEmployeesQuery): Promise<{ rows: Employee[]; total: number }> {
    const where = buildWhere(query);
    const offset = (query.page - 1) * query.pageSize;

    // The order and the count are independent, so they run at the same time.
    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
        SELECT e.id ${FROM_EMPLOYEES}
        ${where}
        ORDER BY ${orderBy(query)}, e.id ASC
        LIMIT ${query.pageSize}::int OFFSET ${offset}::int`),
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total ${FROM_EMPLOYEES} ${where}`),
    ]);

    const total = countRows[0]?.total ?? 0;
    const ids = idRows.map((row) => row.id);
    return { rows: await this.loadInOrder(ids), total };
  }

  async distinctCountries(): Promise<string[]> {
    const rows = await this.prisma.employee.findMany({
      distinct: ['country'],
      select: { country: true },
    });
    return rows.map((row) => row.country);
  }

  async distinctDepartments(): Promise<string[]> {
    const rows = await this.prisma.employee.findMany({
      distinct: ['department'],
      select: { department: true },
    });
    return rows.map((row) => row.department);
  }

  /** Loads the employees for one page of ids, and puts them back in the order of the ids. */
  private async loadInOrder(ids: number[]): Promise<Employee[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      include: { compensation: true },
    });
    const byId = new Map(rows.map((row) => [row.id, toEmployee(row)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }
}

/** The WHERE clause: every filter that was given, joined with AND. */
function buildWhere(query: ListEmployeesQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (query.q) {
    const pattern = containsPattern(query.q);
    conditions.push(
      Prisma.sql`(e.full_name ILIKE ${pattern} OR e.email ILIKE ${pattern} OR e.employee_code ILIKE ${pattern})`,
    );
  }
  if (query.country) conditions.push(Prisma.sql`e.country = ${query.country}`);
  if (query.department) conditions.push(Prisma.sql`e.department = ${query.department}`);
  if (query.level) conditions.push(Prisma.sql`e.level = ${query.level}`);
  if (query.status) conditions.push(Prisma.sql`e.employment_status = ${query.status}`);
  if (query.currency) conditions.push(Prisma.sql`c.currency = ${query.currency}`);

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

/** The ORDER BY expression and direction. The id tie-breaker is added by the caller. */
function orderBy(query: ListEmployeesQuery): Prisma.Sql {
  const direction = query.sortDir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  return Prisma.sql`${sortExpression(query)} ${direction}`;
}

function sortExpression(query: ListEmployeesQuery): Prisma.Sql {
  if (query.sortBy === 'salary') {
    return query.view === 'usd' ? usdAmount() : Prisma.sql`c.amount`;
  }
  return Prisma.raw(SORT_SQL[query.sortBy]);
}

/**
 * A salary converted to USD with the fixed rates, kept as an exact decimal and not rounded,
 * so the order is right even when two salaries differ by less than a cent after conversion.
 */
function usdAmount(): Prisma.Sql {
  const branches = Object.entries(USD_PER_UNIT).map(
    ([currency, rate]) => Prisma.sql`WHEN ${currency} THEN c.amount * ${String(rate)}::numeric`,
  );
  return Prisma.sql`(CASE c.currency ${Prisma.join(branches, ' ')} END)`;
}
