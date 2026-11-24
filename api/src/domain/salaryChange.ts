import { BusinessRuleError, ValidationError } from '../errors/appErrors.js';
import type { Money } from './money.js';

export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 255;

export interface SalaryChangeRequest {
  currentAmount: Money;
  newAmount: Money;
  /** Typed `unknown` because it comes straight from a request body. */
  reason: unknown;
}

export interface ValidSalaryChange {
  newAmount: Money;
  /** The reason with surrounding whitespace removed. */
  reason: string;
}

/**
 * Checks the business rules for changing a salary:
 *  - R-08: a reason of 3 to 255 characters (after trimming) is required.
 *  - R-07: the new amount must differ from the current one.
 *
 * The reason is checked first. A missing reason is a simple input mistake (400),
 * while an unchanged amount is a rule violation (422).
 *
 * @throws ValidationError when the reason is missing, too short or too long
 * @throws BusinessRuleError when the amount did not change
 */
export function validateSalaryChange(request: SalaryChangeRequest): ValidSalaryChange {
  const reason = validateReason(request.reason);

  if (request.newAmount.equals(request.currentAmount)) {
    throw new BusinessRuleError('The salary was not changed.', [
      { field: 'amount', message: 'The new amount is the same as the current amount.' },
    ]);
  }

  return { newAmount: request.newAmount, reason };
}

function validateReason(input: unknown): string {
  const reason = typeof input === 'string' ? input.trim() : '';

  if (reason.length === 0) return rejectReason('A reason is required.');
  if (reason.length < REASON_MIN_LENGTH) {
    return rejectReason(`Reason must be at least ${REASON_MIN_LENGTH} characters.`);
  }
  if (reason.length > REASON_MAX_LENGTH) {
    return rejectReason(`Reason must be at most ${REASON_MAX_LENGTH} characters.`);
  }
  return reason;
}

function rejectReason(message: string): never {
  throw new ValidationError('Some fields are invalid.', [{ field: 'reason', message }]);
}
