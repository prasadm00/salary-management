import { COUNTRIES } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/appErrors.js';
import { assertCurrencyMatchesCountry, currencyForCountry, isKnownCountry } from './currency.js';

function detailOf(action: () => void) {
  try {
    action();
  } catch (error) {
    if (error instanceof ValidationError) return error.details?.[0];
    throw error;
  }
  throw new Error('Expected the action to be rejected');
}

describe('currencyForCountry', () => {
  it.each([
    ['IN', 'INR'],
    ['US', 'USD'],
    ['GB', 'GBP'],
    ['DE', 'EUR'],
    ['FR', 'EUR'],
    ['JP', 'JPY'],
  ])('maps %s to %s', (country, currency) => {
    expect(currencyForCountry(country)).toBe(currency);
  });

  it('knows a currency for every country in the reference data', () => {
    for (const country of COUNTRIES) {
      expect(currencyForCountry(country.code)).toBe(country.currency);
    }
  });

  it.each(['XX', 'in', 'India', '', 'USA'])('rejects the unknown country "%s"', (country) => {
    expect(detailOf(() => currencyForCountry(country))).toEqual({
      field: 'country',
      message: 'Country is not supported.',
    });
  });
});

describe('isKnownCountry', () => {
  it('is true for supported countries and false for anything else', () => {
    expect(isKnownCountry('IN')).toBe(true);
    expect(isKnownCountry('XX')).toBe(false);
    expect(isKnownCountry('in')).toBe(false);
  });
});

describe('R-06: the currency must match the employee country', () => {
  it('accepts a valid pair', () => {
    expect(() => assertCurrencyMatchesCountry('IN', 'INR')).not.toThrow();
    expect(() => assertCurrencyMatchesCountry('US', 'USD')).not.toThrow();
  });

  it('accepts EUR for both Germany and France', () => {
    expect(() => assertCurrencyMatchesCountry('DE', 'EUR')).not.toThrow();
    expect(() => assertCurrencyMatchesCountry('FR', 'EUR')).not.toThrow();
  });

  it('rejects a mismatch and says which currency is expected', () => {
    expect(detailOf(() => assertCurrencyMatchesCountry('IN', 'USD'))).toEqual({
      field: 'currency',
      message: 'The currency does not match the country. Expected INR.',
    });
  });

  it('rejects EUR for a country that does not use the euro', () => {
    expect(() => assertCurrencyMatchesCountry('GB', 'EUR')).toThrowError(ValidationError);
  });

  it('rejects a lower-case currency code', () => {
    expect(() => assertCurrencyMatchesCountry('IN', 'inr')).toThrowError(ValidationError);
  });

  it('rejects an unknown country before looking at the currency', () => {
    expect(detailOf(() => assertCurrencyMatchesCountry('XX', 'USD'))?.field).toBe('country');
  });
});
