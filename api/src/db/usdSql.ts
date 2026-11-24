import { USD_PER_UNIT } from '@acme/shared';
import { Prisma } from '../generated/prisma/client.js';

/**
 * SQL for a salary converted to US dollars with the fixed rates (decision 007).
 * The salary is `c.amount` and its currency is `c.currency`, so the query must join `compensations c`.
 *
 * The result is an exact decimal and is not rounded. Rounding happens once, at the very end
 * (R-38), by whoever shows the figure. The rates are sent as parameters, never joined into the text.
 */
export function usdAmountSql(): Prisma.Sql {
  const branches = Object.entries(USD_PER_UNIT).map(
    ([currency, rate]) => Prisma.sql`WHEN ${currency} THEN c.amount * ${String(rate)}::numeric`,
  );
  return Prisma.sql`(CASE c.currency ${Prisma.join(branches, ' ')} END)`;
}
