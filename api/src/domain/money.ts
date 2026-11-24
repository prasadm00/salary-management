import Decimal from 'decimal.js';
import { ValidationError } from '../errors/appErrors.js';

/**
 * Our own copy of the decimal library, so its settings cannot be changed elsewhere.
 * Precision is generous (40 digits) so multiplication never loses digits, and
 * rounding is "half away from zero", the usual rule for money.
 */
const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const MAX_WHOLE_DIGITS = 12; // NUMERIC(14,2): 14 digits in total, 2 of them after the point
const MAX_DECIMAL_PLACES = 2;

const MESSAGES = {
  notText: 'Amount must be given as text, for example "2400000.00".',
  badFormat: 'Amount must be a plain number such as 2400000.00.',
  notPositive: 'Amount must be greater than zero.',
  tooManyDecimals: 'Amount must have at most two decimal places.',
  tooLarge: `Amount is too large. Use at most ${MAX_WHOLE_DIGITS} digits before the decimal point.`,
} as const;

/** Optional minus sign, digits, optional point and digits. No exponent, spaces or separators. */
const PLAIN_DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * An exact amount of money. Immutable.
 *
 * Salaries never pass through a JavaScript `number`, which cannot store 0.1 exactly.
 * Money comes in as text, is held as an exact decimal, and goes out as text.
 * Rounding happens in one place only: {@link Money.round2}, which `toString` uses.
 */
export class Money {
  private constructor(private readonly value: Decimal) {}

  /**
   * Reads an amount from text such as "2400000.00".
   * Accepts 1 to 12 digits, then an optional point and 1 or 2 decimals. Must be above zero.
   *
   * @param input the raw value, typed `unknown` because it comes from a request body
   * @param field name shown next to the error message in the UI
   * @throws ValidationError when the input is not a valid amount
   */
  static parse(input: unknown, field = 'amount'): Money {
    const reject = (message: string): never => {
      throw new ValidationError('Some fields are invalid.', [{ field, message }]);
    };

    if (typeof input !== 'string') return reject(MESSAGES.notText);

    const match = PLAIN_DECIMAL.exec(input);
    if (!match) return reject(MESSAGES.badFormat);

    const [, minus, whole = '', decimals = ''] = match;
    if (minus) return reject(MESSAGES.notPositive);
    if (decimals.length > MAX_DECIMAL_PLACES) return reject(MESSAGES.tooManyDecimals);
    if (whole.length > MAX_WHOLE_DIGITS) return reject(MESSAGES.tooLarge);

    const value = new Dec(input);
    if (value.isZero()) return reject(MESSAGES.notPositive);

    return new Money(value);
  }

  /** The sum of two amounts. Returns a new Money. */
  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  /**
   * Multiplies by an exchange rate in full precision, without rounding.
   * Call {@link Money.round2} (or `toString`) once at the very end.
   * The rate may be text or a number literal from our fixed rates table.
   *
   * @throws Error when the rate is not a positive, finite number (a programming mistake)
   */
  convert(rate: number | string): Money {
    const decimalRate = toRate(rate);
    return new Money(this.value.times(decimalRate));
  }

  /** Rounds to two decimals, half away from zero. The one place rounding happens. */
  round2(): Money {
    return new Money(this.value.toDecimalPlaces(MAX_DECIMAL_PLACES, Decimal.ROUND_HALF_UP));
  }

  /** True when both amounts are exactly the same value ("100" equals "100.00"). */
  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  /** Text with exactly two decimals, for example "2400000.00". */
  toString(): string {
    return this.round2().value.toFixed(MAX_DECIMAL_PLACES);
  }

  /** Text with the currency code, for example "2400000.00 INR". */
  format(currency: string): string {
    return `${this.toString()} ${currency}`;
  }

  /** JSON gets the text form, so an amount is never sent as a number. */
  toJSON(): string {
    return this.toString();
  }
}

function toRate(rate: number | string): Decimal {
  const invalid = (): never => {
    throw new Error('Invalid exchange rate: it must be a positive, finite number.');
  };

  if (typeof rate === 'number' && !Number.isFinite(rate)) return invalid();
  if (typeof rate === 'string' && !/^\d+(\.\d+)?$/.test(rate)) return invalid();

  const decimal = new Dec(rate);
  return decimal.greaterThan(0) ? decimal : invalid();
}
