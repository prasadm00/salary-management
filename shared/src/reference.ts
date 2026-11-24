/**
 * Reference data used by both the API and the UI. Lives in code, not in the database,
 * so changes are reviewed in a pull request (see docs/LLD.md section 1.5).
 */

/** Supported countries and the one currency each uses. Adding a country is one line. */
export const COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
] as const;

export type Country = (typeof COUNTRIES)[number];
/** ISO 3166-1 alpha-2, for example "IN". */
export type CountryCode = Country['code'];
/** ISO 4217, for example "INR". */
export type CurrencyCode = Country['currency'];

/** The date shown next to every USD figure. */
export const USD_RATES_AS_OF = '2026-01-01';

/** Shown in the UI whenever the USD view is on (decision 007). */
export const USD_RATES_NOTE = 'Fixed, illustrative exchange rates. Not live market data.';

/**
 * How many US dollars one unit of each currency is worth.
 * These are placeholder numbers chosen to look reasonable, not market data.
 */
export const USD_PER_UNIT = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  JPY: 0.0067,
  AUD: 0.66,
  CAD: 0.74,
  SGD: 0.74,
  BRL: 0.2,
} as const satisfies Record<CurrencyCode, number>;
