import { z } from 'zod';
import { Money } from '../domain/money.js';
import { ValidationError } from '../errors/appErrors.js';

/**
 * A request field holding an amount of money, such as "2400000.00".
 * Turns valid text into a {@link Money} and reports problems against the field's own name.
 */
export function moneyField(field: string) {
  const label = field.charAt(0).toUpperCase() + field.slice(1);

  return z.unknown().transform((value, context): Money => {
    if (value === undefined) {
      context.addIssue({ code: 'custom', message: `${label} is required.` });
      return z.NEVER;
    }

    try {
      return Money.parse(value, field);
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      // The money messages start with "Amount". Use this field's name instead.
      const message = (error.details?.[0]?.message ?? error.message).replace(/^Amount/, label);
      context.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
  });
}
