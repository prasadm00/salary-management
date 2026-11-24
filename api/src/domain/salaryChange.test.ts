import { describe, expect, it } from 'vitest';
import { BusinessRuleError, ValidationError } from '../errors/appErrors.js';
import { Money } from './money.js';
import { validateSalaryChange } from './salaryChange.js';

const current = Money.parse('2000000.00');
const raised = Money.parse('2400000.00');

function change(overrides: { newAmount?: Money; reason?: unknown } = {}) {
  return validateSalaryChange({
    currentAmount: current,
    newAmount: overrides.newAmount ?? raised,
    reason: 'reason' in overrides ? overrides.reason : 'Annual review 2025',
  });
}

function errorOf(action: () => unknown): ValidationError | BusinessRuleError {
  try {
    action();
  } catch (error) {
    if (error instanceof ValidationError || error instanceof BusinessRuleError) return error;
    throw error;
  }
  throw new Error('Expected the change to be rejected');
}

describe('validateSalaryChange', () => {
  it('accepts a different amount with a reason', () => {
    const result = change();

    expect(result.newAmount.toString()).toBe('2400000.00');
    expect(result.reason).toBe('Annual review 2025');
  });

  it('accepts a decrease as well as an increase', () => {
    expect(() => change({ newAmount: Money.parse('1900000.00') })).not.toThrow();
  });

  it('accepts a change of one cent', () => {
    expect(() => change({ newAmount: Money.parse('2000000.01') })).not.toThrow();
  });

  describe('R-07: a salary change must change the amount', () => {
    it('rejects the same amount with a 422 business rule error', () => {
      const error = errorOf(() => change({ newAmount: Money.parse('2000000.00') }));

      expect(error).toBeInstanceOf(BusinessRuleError);
      expect(error.statusCode).toBe(422);
      expect(error.details).toEqual([
        { field: 'amount', message: 'The new amount is the same as the current amount.' },
      ]);
    });

    it('treats 2000000 and 2000000.00 as the same amount', () => {
      expect(() => change({ newAmount: Money.parse('2000000') })).toThrowError(BusinessRuleError);
    });
  });

  describe('R-08: a reason of 3 to 255 characters is required', () => {
    it.each([
      ['an empty text', ''],
      ['only spaces', '   '],
      ['only tabs and new lines', '\t\n '],
      ['nothing at all', undefined],
      ['null', null],
      ['a number instead of text', 42],
    ])('rejects %s', (_label, reason) => {
      const error = errorOf(() => change({ reason }));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.details).toEqual([{ field: 'reason', message: 'A reason is required.' }]);
    });

    it('rejects a reason shorter than 3 characters', () => {
      const error = errorOf(() => change({ reason: 'ab' }));

      expect(error.details).toEqual([
        { field: 'reason', message: 'Reason must be at least 3 characters.' },
      ]);
    });

    it('counts characters after trimming, so padding does not help', () => {
      expect(() => change({ reason: '   ab   ' })).toThrowError(ValidationError);
    });

    it('accepts exactly 3 and exactly 255 characters', () => {
      expect(() => change({ reason: 'abc' })).not.toThrow();
      expect(() => change({ reason: 'a'.repeat(255) })).not.toThrow();
    });

    it('rejects 256 characters', () => {
      const error = errorOf(() => change({ reason: 'a'.repeat(256) }));

      expect(error.details).toEqual([
        { field: 'reason', message: 'Reason must be at most 255 characters.' },
      ]);
    });

    it('returns the reason trimmed', () => {
      expect(change({ reason: '  Promotion to L4  ' }).reason).toBe('Promotion to L4');
    });
  });

  it('reports a missing reason before the unchanged amount, because it is a simpler fix', () => {
    const error = errorOf(() => change({ newAmount: current, reason: '' }));

    expect(error).toBeInstanceOf(ValidationError);
  });
});
