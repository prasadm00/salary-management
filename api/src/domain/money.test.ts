import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/appErrors.js';
import { Money } from './money.js';

/** Runs `parse` and returns the first field message, so tests read like the rule they check. */
function messageFor(input: unknown, field?: string): string {
  try {
    Money.parse(input, field);
  } catch (error) {
    if (error instanceof ValidationError) return error.details?.[0]?.message ?? error.message;
    throw error;
  }
  throw new Error(`Expected "${String(input)}" to be rejected`);
}

describe('Money.parse', () => {
  describe('accepts valid amounts', () => {
    it.each([
      ['100', '100.00'],
      ['100.5', '100.50'],
      ['100.55', '100.55'],
      ['0.01', '0.01'],
      ['2400000.00', '2400000.00'],
      ['999999999999.99', '999999999999.99'],
    ])('accepts "%s" and shows it as %s', (input, shown) => {
      expect(Money.parse(input).toString()).toBe(shown);
    });
  });

  describe('R-01: the amount must be greater than zero', () => {
    it.each(['0', '0.0', '0.00', '000'])('rejects zero written as "%s"', (input) => {
      expect(messageFor(input)).toBe('Amount must be greater than zero.');
    });

    it.each(['-1', '-0.01', '-100.00'])('rejects the negative amount "%s"', (input) => {
      expect(messageFor(input)).toBe('Amount must be greater than zero.');
    });
  });

  describe('R-02: at most two decimal places', () => {
    it.each(['10.001', '0.005', '99.999', '1.123456'])('rejects "%s"', (input) => {
      expect(messageFor(input)).toBe('Amount must have at most two decimal places.');
    });
  });

  describe('R-03: amounts are text, never JavaScript numbers', () => {
    it.each([100, 100.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the number %s',
      (input) => {
        expect(messageFor(input)).toBe('Amount must be given as text, for example "2400000.00".');
      },
    );

    it.each([null, undefined, true, {}, [], 10n])('rejects the non-text value %s', (input) => {
      expect(messageFor(input)).toBe('Amount must be given as text, for example "2400000.00".');
    });

    it.each(['1e6', '1E3', '2.5e2'])('rejects exponent notation "%s"', (input) => {
      expect(messageFor(input)).toBe('Amount must be a plain number such as 2400000.00.');
    });

    it.each(['', ' ', ' 100', '100 ', 'abc', '1,000', '$100', '.5', '5.', '+5', '1_000', '0x10'])(
      'rejects the badly formatted "%s"',
      (input) => {
        expect(messageFor(input)).toBe('Amount must be a plain number such as 2400000.00.');
      },
    );

    it('rejects the special words NaN and Infinity', () => {
      expect(messageFor('NaN')).toBe('Amount must be a plain number such as 2400000.00.');
      expect(messageFor('Infinity')).toBe('Amount must be a plain number such as 2400000.00.');
    });
  });

  describe('R-05: the amount fits NUMERIC(14,2), so at most 12 digits before the point', () => {
    it('accepts 12 whole digits', () => {
      expect(Money.parse('999999999999').toString()).toBe('999999999999.00');
    });

    it('rejects 13 whole digits', () => {
      expect(messageFor('1234567890123')).toBe(
        'Amount is too large. Use at most 12 digits before the decimal point.',
      );
    });
  });

  describe('error shape', () => {
    it('throws a ValidationError that points at the "amount" field by default', () => {
      expect.assertions(2);
      try {
        Money.parse('-5');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).details?.[0]?.field).toBe('amount');
      }
    });

    it('can point at another field, such as "salary"', () => {
      expect.assertions(1);
      try {
        Money.parse('-5', 'salary');
      } catch (error) {
        expect((error as ValidationError).details?.[0]?.field).toBe('salary');
      }
    });

    it('never echoes the rejected input back in the message', () => {
      expect(messageFor('<script>alert(1)</script>')).not.toContain('script');
    });
  });
});

describe('Money arithmetic never uses floating point', () => {
  it('R-04: adds 0.10 and 0.20 to exactly 0.30 (JavaScript numbers give 0.30000000000000004)', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem this class exists to avoid

    const total = Money.parse('0.10').add(Money.parse('0.20'));

    expect(total.toString()).toBe('0.30');
    expect(total.equals(Money.parse('0.30'))).toBe(true);
  });

  it('adds ten times 0.10 to exactly 1.00', () => {
    let total = Money.parse('0.10');
    for (let i = 1; i < 10; i++) total = total.add(Money.parse('0.10'));

    expect(total.toString()).toBe('1.00');
  });

  it('multiplies by a rate without drift (JavaScript gives 100 * 0.07 = 7.000000000000001)', () => {
    expect(100 * 0.07).not.toBe(7); // the problem this class exists to avoid

    expect(Money.parse('100').convert(0.07).toString()).toBe('7.00');
  });

  it('converts a salary with the fixed INR rate exactly', () => {
    expect(Money.parse('2400000.00').convert(0.012).toString()).toBe('28800.00');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 'abc', ''])(
    'refuses the invalid exchange rate %s instead of producing a wrong amount',
    (rate) => {
      expect(() => Money.parse('100').convert(rate)).toThrowError(/exchange rate/i);
    },
  );

  it('accepts the rate as text too', () => {
    expect(Money.parse('2400000.00').convert('0.012').toString()).toBe('28800.00');
  });

  it('keeps full precision between steps and rounds only at the end (R-38)', () => {
    // 0.01 x 0.5 = 0.005, then x 2 = 0.01. Rounding 0.005 to 0.01 in the middle would give 0.02.
    const result = Money.parse('0.01').convert('0.5').convert('2');

    expect(result.toString()).toBe('0.01');
  });

  it('rounds half away from zero, correctly where floats fail (1.005 becomes 1.01)', () => {
    expect((1.005).toFixed(2)).toBe('1.00'); // the problem this class exists to avoid

    expect(Money.parse('1.00').convert('1.005').toString()).toBe('1.01');
    expect(Money.parse('0.01').convert('12.5').toString()).toBe('0.13');
  });

  it('round2 returns a Money with exactly two decimals', () => {
    const rounded = Money.parse('1.00').convert('1.0049').round2();

    expect(rounded.toString()).toBe('1.00');
    expect(rounded.convert('1000').toString()).toBe('1000.00');
  });
});

describe('Money.equals', () => {
  it('treats 100 and 100.00 as the same amount', () => {
    expect(Money.parse('100').equals(Money.parse('100.00'))).toBe(true);
  });

  it('tells apart amounts that differ by one cent', () => {
    expect(Money.parse('100.00').equals(Money.parse('100.01'))).toBe(false);
  });
});

describe('Money formatting', () => {
  it('always shows two decimals', () => {
    expect(Money.parse('5').toString()).toBe('5.00');
    expect(Money.parse('5.1').toString()).toBe('5.10');
  });

  it('formats with its currency', () => {
    expect(Money.parse('2400000').format('INR')).toBe('2400000.00 INR');
    expect(Money.parse('95000.5').format('USD')).toBe('95000.50 USD');
  });

  it('serialises to JSON as a string, never a number', () => {
    expect(JSON.stringify({ amount: Money.parse('95000.5') })).toBe('{"amount":"95000.50"}');
  });
});

describe('Money is immutable', () => {
  it('add and convert return new values and leave the original unchanged', () => {
    const original = Money.parse('10.00');

    original.add(Money.parse('5.00'));
    original.convert('3');

    expect(original.toString()).toBe('10.00');
  });
});
