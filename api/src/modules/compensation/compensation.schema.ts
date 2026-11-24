import { z } from 'zod';
import { moneyField } from '../../validation/moneyField.js';

/**
 * Body of PATCH /api/employees/:id/compensation (docs/API.md section 2.4).
 *
 * Only `amount` and `reason` are accepted. Any other field, such as `currency`, is
 * rejected, because the currency of an existing salary cannot change (R-09).
 * The reason is checked by the salary change rules (R-08), so its messages live in one place.
 */
export const changeSalarySchema = z.strictObject({
  amount: moneyField('amount'),
  // Optional here on purpose: a missing reason gets the friendly "A reason is required." from the domain.
  reason: z.unknown().optional(),
});

export type ChangeSalaryInput = z.output<typeof changeSalarySchema>;
