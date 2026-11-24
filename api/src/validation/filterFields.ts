import { CURRENCY_VIEWS, LEVELS } from '@acme/shared';
import { z } from 'zod';
import { isKnownCountry, isKnownCurrency } from '../domain/currency.js';

const DEPARTMENT_MAX_LENGTH = 60;

/**
 * Query-string fields used by more than one endpoint (the employee list and the analytics).
 * Each is optional unless it has a default. A repeated parameter such as
 * `?country=IN&country=US` is refused, so the API never silently picks one value.
 */

export const countryField = z
  .string({ error: 'Country is not supported.' })
  .refine(isKnownCountry, { error: 'Country is not supported.' })
  .optional();

export const departmentField = z
  .string({ error: 'Department must be given once, as text.' })
  .trim()
  .min(1, { error: 'Department must not be empty.' })
  .max(DEPARTMENT_MAX_LENGTH, {
    error: `Department must be at most ${DEPARTMENT_MAX_LENGTH} characters.`,
  })
  .optional();

export const levelField = z.enum(LEVELS, { error: 'Level must be one of L1 to L6.' }).optional();

export const currencyField = z
  .string({ error: 'Currency is not supported.' })
  .refine(isKnownCurrency, { error: 'Currency is not supported.' })
  .optional();

/** `local` keeps each currency apart. `usd` converts with the fixed, illustrative rates. */
export const viewField = z
  .enum(CURRENCY_VIEWS, { error: 'View must be local or usd.' })
  .default('local');
