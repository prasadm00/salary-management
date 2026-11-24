import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  CURRENCIES,
  USD_PER_UNIT,
  USD_RATES_AS_OF,
  USD_RATES_NOTE,
} from './reference.js';

describe('country reference data', () => {
  it('covers ten countries, enough for a meaningful multi-country organisation', () => {
    expect(COUNTRIES).toHaveLength(10);
  });

  it('uses unique, upper-case two-letter country codes', () => {
    const codes = COUNTRIES.map((country) => country.code);

    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it('uses upper-case three-letter currency codes', () => {
    for (const country of COUNTRIES) expect(country.currency).toMatch(/^[A-Z]{3}$/);
  });

  it('has a readable name for every country', () => {
    for (const country of COUNTRIES) expect(country.name.trim().length).toBeGreaterThan(1);
  });

  it('lets Germany and France share the euro, so there are nine currencies', () => {
    const currencyOf = (code: string) =>
      COUNTRIES.find((country) => country.code === code)?.currency;

    expect(currencyOf('DE')).toBe('EUR');
    expect(currencyOf('FR')).toBe('EUR');
    expect(new Set(COUNTRIES.map((country) => country.currency)).size).toBe(9);
  });
});

describe('CURRENCIES', () => {
  it('lists each currency in use once, in alphabetical order', () => {
    expect(CURRENCIES).toEqual(['AUD', 'BRL', 'CAD', 'EUR', 'GBP', 'INR', 'JPY', 'SGD', 'USD']);
  });
});

describe('USD rates (fixed and illustrative)', () => {
  it('has a rate for every currency in use, and for no other', () => {
    const used = new Set(COUNTRIES.map((country) => country.currency));

    expect(new Set(Object.keys(USD_PER_UNIT))).toEqual(used);
  });

  it('treats one US dollar as exactly one US dollar', () => {
    expect(USD_PER_UNIT.USD).toBe(1);
  });

  it('only has positive, finite rates', () => {
    for (const rate of Object.values(USD_PER_UNIT)) {
      expect(rate).toBeGreaterThan(0);
      expect(Number.isFinite(rate)).toBe(true);
    }
  });

  it('shows the date the rates are "as of" as a real calendar date', () => {
    expect(USD_RATES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(USD_RATES_AS_OF).toISOString().slice(0, 10)).toBe(USD_RATES_AS_OF);
  });

  it('says plainly that the rates are not live market data', () => {
    expect(USD_RATES_NOTE).toMatch(/illustrative/i);
  });
});
