import { COUNTRIES, type CountryCode, type CurrencyCode } from '@acme/shared';
import { ValidationError } from '../errors/appErrors.js';

const CURRENCY_BY_COUNTRY: ReadonlyMap<string, CurrencyCode> = new Map(
  COUNTRIES.map((country) => [country.code, country.currency]),
);

/** True when the code is one of the supported countries (upper case, for example "IN"). */
export function isKnownCountry(code: string): code is CountryCode {
  return CURRENCY_BY_COUNTRY.has(code);
}

/**
 * The currency an employee in this country is paid in.
 * @throws ValidationError when the country is not supported
 */
export function currencyForCountry(country: string): CurrencyCode {
  const currency = CURRENCY_BY_COUNTRY.get(country);
  if (!currency) {
    throw new ValidationError('Some fields are invalid.', [
      { field: 'country', message: 'Country is not supported.' },
    ]);
  }
  return currency;
}

/**
 * R-06: a salary must be in the currency of the employee's country.
 * @throws ValidationError when the country is unknown or the currency does not match
 */
export function assertCurrencyMatchesCountry(country: string, currency: string): void {
  const expected = currencyForCountry(country);
  if (currency !== expected) {
    throw new ValidationError('Some fields are invalid.', [
      {
        field: 'currency',
        message: `The currency does not match the country. Expected ${expected}.`,
      },
    ]);
  }
}
