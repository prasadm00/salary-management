import type { ExtremeEmployee } from '@acme/shared';
import type { PrismaClient } from '../../db/prisma.js';
import { usdAmountSql } from '../../db/usdSql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  AnalyticsRepository,
  DistributionData,
  ExtremeRows,
  GroupBy,
  RecentChangeRow,
  StatsRowData,
} from './analytics.repository.js';
import type { AnalyticsFilters } from './analytics.schema.js';

const FROM_EMPLOYEES = Prisma.sql`FROM employees e JOIN compensations c ON c.employee_id = e.id`;

/** The PostgreSQL implementation. Every value is sent as a parameter, never joined into the SQL text. */
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async countEmployees(filters: AnalyticsFilters): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total ${FROM_EMPLOYEES} ${buildWhere(filters)}`);
    return rows[0]?.total ?? 0;
  }

  /**
   * One row per group and currency.
   *
   * The median is computed exactly (R-36). PostgreSQL's `percentile_cont` turns numbers into
   * floating point, which would break exact money. Instead the salaries of each group are
   * collected in order into an array `a` of `n` values, and the middle is picked by position:
   *
   *   median  = (a[(n+1)/2] + a[(n+2)/2]) / 2     (one middle value when n is odd, two when even)
   *   p25     = a[ceil(n x 0.25)] = a[(n+3)/4]    (nearest rank, R-37)
   *   p75     = a[ceil(n x 0.75)] = a[(3n+3)/4]
   *
   * The divisions are whole-number divisions, so no floating point is involved.
   * Everything is rounded to two decimals once, at the end, half away from zero (R-38).
   */
  async groupStats(groupBy: GroupBy, filters: AnalyticsFilters): Promise<StatsRowData[]> {
    const amount = amountSql(filters.view);

    return this.prisma.$queryRaw<StatsRowData[]>(Prisma.sql`
      SELECT
        g.key,
        g.currency,
        g.n AS headcount,
        round(g.lowest, 2)::text AS min,
        round(g.highest, 2)::text AS max,
        round(g.mean, 2)::text AS average,
        round((g.a[(g.n + 1) / 2] + g.a[(g.n + 2) / 2]) / 2, 2)::text AS median,
        round(g.a[(g.n + 3) / 4], 2)::text AS p25,
        round(g.a[(3 * g.n + 3) / 4], 2)::text AS p75
      FROM (
        SELECT
          ${keySql(groupBy)} AS key,
          ${currencySql(filters.view)} AS currency,
          count(*)::int AS n,
          min(${amount}) AS lowest,
          max(${amount}) AS highest,
          avg(${amount}) AS mean,
          array_agg(${amount} ORDER BY ${amount}) AS a
        ${FROM_EMPLOYEES}
        ${buildWhere(filters)}
        GROUP BY 1, 2
      ) g
      ORDER BY lower(g.key), g.currency`);
  }

  /**
   * Equal-width buckets. The width is the range divided by the bucket count, rounded UP to a
   * whole cent, so every edge is an exact amount (no fractions of a cent) and the buckets
   * always cover the range. A person goes in bucket floor((amount - min) / width), and the
   * maximum is kept in the last bucket. Each bucket includes its `from` and excludes its `to`.
   *
   * In the USD view each salary is first rounded to a whole cent, as it is shown elsewhere.
   */
  async distribution(
    filters: AnalyticsFilters,
    currency: string | undefined,
    buckets: number,
  ): Promise<DistributionData> {
    const value =
      filters.view === 'usd' ? Prisma.sql`round(${usdAmountSql()}, 2)` : Prisma.sql`c.amount`;

    const rows = await this.prisma.$queryRaw<DistributionRow[]>(Prisma.sql`
      WITH vals AS (
        SELECT ${value} AS a ${FROM_EMPLOYEES} ${buildWhere(filters, currency)}
      ),
      bounds AS (
        SELECT count(*)::int AS n, min(a) AS lowest, max(a) AS highest FROM vals
      ),
      sizing AS (
        SELECT n, lowest, highest,
          CASE WHEN highest = lowest THEN 0
               ELSE round(ceil((highest - lowest) * 100 / ${buckets}::int) / 100, 2) END AS width
        FROM bounds WHERE n > 0
      ),
      placed AS (
        SELECT CASE WHEN s.width = 0 THEN 0
                    ELSE LEAST(floor((v.a - s.lowest) / s.width)::int, ${buckets}::int - 1) END AS i
        FROM vals v CROSS JOIN sizing s
      ),
      counts AS (
        SELECT i, count(*)::int AS c FROM placed GROUP BY i
      )
      SELECT
        s.n,
        round(s.lowest, 2)::text AS min,
        round(s.highest, 2)::text AS max,
        round(s.lowest + g.i * s.width, 2)::text AS "from",
        round(s.lowest + (g.i + 1) * s.width, 2)::text AS "to",
        coalesce(c.c, 0) AS count
      FROM sizing s
      CROSS JOIN generate_series(0, CASE WHEN s.width = 0 THEN 0 ELSE ${buckets}::int - 1 END) AS g(i)
      LEFT JOIN counts c ON c.i = g.i
      ORDER BY g.i`);

    const first = rows[0];
    if (!first) return { headcount: 0, min: null, max: null, buckets: [] };

    return {
      headcount: first.n,
      min: first.min,
      max: first.max,
      buckets: rows.map((row) => ({ from: row.from, to: row.to, count: row.count })),
    };
  }

  async extremes(
    filters: AnalyticsFilters,
    currency: string | undefined,
    limit: number,
  ): Promise<ExtremeRows> {
    const amount = amountSql(filters.view);
    const where = buildWhere(filters, currency);

    const pick = (direction: Prisma.Sql) =>
      this.prisma.$queryRaw<ExtremeDbRow[]>(Prisma.sql`
        SELECT e.id, e.employee_code, e.full_name, e.department, e.level, e.country,
               round(${amount}, 2)::text AS amount
        ${FROM_EMPLOYEES}
        ${where}
        ORDER BY ${amount} ${direction}, e.id ASC
        LIMIT ${limit}::int`);

    // The two lists are independent, so they run at the same time.
    const [top, bottom] = await Promise.all([pick(Prisma.sql`DESC`), pick(Prisma.sql`ASC`)]);
    return { top: top.map(toExtremeEmployee), bottom: bottom.map(toExtremeEmployee) };
  }

  async recentChanges(limit: number): Promise<RecentChangeRow[]> {
    const rows = await this.prisma.compensationChange.findMany({
      // A change has an old amount. The starting salary does not, and is not a change.
      where: { oldAmount: { not: null } },
      // The id breaks ties, so two changes at the same moment have a fixed order.
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { employee: { select: { id: true, employeeCode: true, fullName: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      employee: row.employee,
      // The filter above guarantees an old amount.
      oldAmount: (row.oldAmount ?? row.newAmount).toFixed(2),
      newAmount: row.newAmount.toFixed(2),
      currency: row.currency,
      reason: row.reason,
      changedAt: row.changedAt.toISOString(),
    }));
  }
}

interface DistributionRow {
  n: number;
  min: string;
  max: string;
  from: string;
  to: string;
  count: number;
}

interface ExtremeDbRow {
  id: number;
  employee_code: string;
  full_name: string;
  department: string;
  level: string;
  country: string;
  amount: string;
}

function toExtremeEmployee(row: ExtremeDbRow): ExtremeEmployee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    department: row.department,
    level: row.level,
    country: row.country,
    amount: row.amount,
  };
}

/** The WHERE clause: every filter that was given, joined with AND. */
function buildWhere(filters: AnalyticsFilters, currency?: string): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filters.country) conditions.push(Prisma.sql`e.country = ${filters.country}`);
  if (filters.department) conditions.push(Prisma.sql`e.department = ${filters.department}`);
  if (filters.level) conditions.push(Prisma.sql`e.level = ${filters.level}`);
  if (filters.status !== 'ALL') {
    conditions.push(Prisma.sql`e.employment_status = ${filters.status}`);
  }
  if (currency) conditions.push(Prisma.sql`c.currency = ${currency}`);

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

/** A salary in its own currency (local view) or converted to dollars, unrounded (USD view). */
function amountSql(view: AnalyticsFilters['view']): Prisma.Sql {
  return view === 'usd' ? usdAmountSql() : Prisma.sql`c.amount`;
}

/** In the USD view everyone is in one currency, so there is a single "USD" group. */
function currencySql(view: AnalyticsFilters['view']): Prisma.Sql {
  return view === 'usd' ? Prisma.sql`'USD'::text` : Prisma.sql`c.currency::text`;
}

/** What each row is about. Written here, in code: request text never becomes SQL. */
function keySql(groupBy: GroupBy): Prisma.Sql {
  switch (groupBy) {
    case 'country':
      return Prisma.sql`e.country::text`;
    case 'department':
      return Prisma.sql`e.department::text`;
    case 'level':
      return Prisma.sql`e.level::text`;
    case 'none':
      return Prisma.sql`NULL::text`;
  }
}
