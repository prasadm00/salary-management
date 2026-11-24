import {
  CURRENCY_VIEWS,
  EMPLOYEE_SORT_COLUMNS,
  EMPLOYMENT_STATUSES,
  LEVELS,
  SORT_DIRECTIONS,
} from '@acme/shared';
import { z } from 'zod';
import { isKnownCountry, isKnownCurrency } from '../../domain/currency.js';
import { pageField, pageSizeField } from '../../validation/pagination.js';

const SEARCH_MAX_LENGTH = 100;
const DEPARTMENT_MAX_LENGTH = 60;

/**
 * The query string of GET /api/employees (docs/API.md section 2.1).
 *
 * Values arrive as text and are checked here, once, at the edge. Unknown parameters
 * are rejected, so a typo such as `?Country=IN` is reported instead of ignored (R-34).
 * Each filter may be given only once, so `?country=IN&country=US` is refused too.
 */
export const employeeListQuerySchema = z.strictObject({
  /** Text to look for in the name, email or employee code. Blank means "no search". */
  q: z
    .string({ error: 'Search text must be given once, as text.' })
    .trim()
    .max(SEARCH_MAX_LENGTH, {
      error: `Search text must be at most ${SEARCH_MAX_LENGTH} characters.`,
    })
    .transform((text) => (text === '' ? undefined : text))
    .optional(),

  country: z
    .string({ error: 'Country is not supported.' })
    .refine(isKnownCountry, { error: 'Country is not supported.' })
    .optional(),
  department: z
    .string({ error: 'Department must be given once, as text.' })
    .trim()
    .min(1, { error: 'Department must not be empty.' })
    .max(DEPARTMENT_MAX_LENGTH, {
      error: `Department must be at most ${DEPARTMENT_MAX_LENGTH} characters.`,
    })
    .optional(),
  level: z.enum(LEVELS, { error: 'Level must be one of L1 to L6.' }).optional(),
  status: z.enum(EMPLOYMENT_STATUSES, { error: 'Status must be ACTIVE or INACTIVE.' }).optional(),
  currency: z
    .string({ error: 'Currency is not supported.' })
    .refine(isKnownCurrency, { error: 'Currency is not supported.' })
    .optional(),

  /** R-31: only these columns can be sorted by. */
  sortBy: z
    .enum(EMPLOYEE_SORT_COLUMNS, {
      error: `Sort column must be one of: ${EMPLOYEE_SORT_COLUMNS.join(', ')}.`,
    })
    .default('fullName'),
  sortDir: z.enum(SORT_DIRECTIONS, { error: 'Sort direction must be asc or desc.' }).default('asc'),
  view: z.enum(CURRENCY_VIEWS, { error: 'View must be local or usd.' }).default('local'),

  page: pageField,
  pageSize: pageSizeField,
});

/** A checked list request, as the service and the repository receive it. */
export type ListEmployeesQuery = z.output<typeof employeeListQuerySchema>;
