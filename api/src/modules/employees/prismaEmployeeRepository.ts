import type { CompensationChange, Employee, EmploymentStatus } from '@acme/shared';
import type { PrismaClient } from '../../db/prisma.js';
import { ConflictError } from '../../errors/appErrors.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  CurrentCompensation,
  EmployeeRepository,
  NewChangeData,
  NewCompensationData,
  NewEmployeeData,
  Paging,
} from './employee.repository.js';
import { toDate, toEmployee } from './employee.mapper.js';

/** The PostgreSQL implementation. Reads and writes only, no business rules. */
export class PrismaEmployeeRepository implements EmployeeRepository {
  /** @param transaction set when this instance runs inside `inTransaction` */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly transaction?: Prisma.TransactionClient,
  ) {}

  private get db(): PrismaClient | Prisma.TransactionClient {
    return this.transaction ?? this.prisma;
  }

  inTransaction<T>(work: (repository: EmployeeRepository) => Promise<T>): Promise<T> {
    if (this.transaction) return work(this);
    return this.prisma.$transaction((tx) => work(new PrismaEmployeeRepository(this.prisma, tx)));
  }

  async nextEmployeeId(): Promise<number> {
    const rows = await this.db.$queryRaw<{ id: number }[]>`
      SELECT nextval(pg_get_serial_sequence('employees', 'id'))::int AS id`;
    const row = rows[0];
    if (!row) throw new Error('Could not reserve an employee id.');
    return row.id;
  }

  async insertEmployee(data: NewEmployeeData): Promise<void> {
    try {
      await this.db.employee.create({
        data: { ...data, hireDate: toDate(data.hireDate) },
      });
    } catch (error) {
      throw toConflict(error) ?? error;
    }
  }

  async insertCompensation(data: NewCompensationData): Promise<void> {
    await this.db.compensation.create({
      data: { ...data, effectiveDate: toDate(data.effectiveDate) },
    });
  }

  async insertChange(data: NewChangeData): Promise<void> {
    await this.db.compensationChange.create({ data });
  }

  async findById(id: number): Promise<Employee | null> {
    const row = await this.db.employee.findUnique({
      where: { id },
      include: { compensation: true },
    });
    return row ? toEmployee(row) : null;
  }

  async lockCompensation(employeeId: number): Promise<CurrentCompensation | null> {
    // FOR UPDATE makes a second change to the same employee wait until this one finishes.
    const rows = await this.db.$queryRaw<CurrentCompensation[]>`
      SELECT amount::text AS amount, currency::text AS currency
      FROM compensations
      WHERE employee_id = ${employeeId}
      FOR UPDATE`;
    return rows[0] ?? null;
  }

  async updateCompensation(
    employeeId: number,
    amount: string,
    effectiveDate: string,
  ): Promise<void> {
    await this.db.compensation.update({
      where: { employeeId },
      data: { amount, effectiveDate: toDate(effectiveDate) },
    });
  }

  async updateStatus(id: number, status: EmploymentStatus): Promise<void> {
    await this.db.employee.update({ where: { id }, data: { employmentStatus: status } });
  }

  async listChanges(
    employeeId: number,
    { page, pageSize }: Paging,
  ): Promise<{ rows: CompensationChange[]; total: number }> {
    const where = { employeeId };
    const [rows, total] = await Promise.all([
      this.db.compensationChange.findMany({
        where,
        // The id breaks ties, so paging never repeats or skips a row.
        orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.compensationChange.count({ where }),
    ]);

    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        oldAmount: row.oldAmount ? row.oldAmount.toFixed(2) : null,
        newAmount: row.newAmount.toFixed(2),
        currency: row.currency,
        reason: row.reason,
        changedAt: row.changedAt.toISOString(),
      })),
    };
  }
}

/**
 * Turns a PostgreSQL "unique constraint" failure into a ConflictError that names the
 * field. Returns undefined for any other error, which the caller rethrows unchanged.
 */
function toConflict(error: unknown): ConflictError | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined;
  }

  switch (violatedIndex(error)) {
    case 'employees_email_key':
      return new ConflictError('An employee with this email already exists.', [
        { field: 'email', message: 'This email is already used.' },
      ]);
    case 'employees_employee_code_key':
      return new ConflictError('An employee with this code already exists.', [
        { field: 'employeeCode', message: 'This employee code is already used.' },
      ]);
    default:
      return new ConflictError('This employee already exists.');
  }
}

/** The name of the unique index that was violated, as reported by the database driver. */
function violatedIndex(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const cause = (
    error.meta?.['driverAdapterError'] as { cause?: { constraint?: { index?: string } } }
  )?.cause;
  return cause?.constraint?.index;
}
