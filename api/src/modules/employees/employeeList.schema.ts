import { EMPLOYEE_SORT_COLUMNS, EMPLOYMENT_STATUSES, SORT_DIRECTIONS } from '@acme/shared';
import { z } from 'zod';
import {
  countryField,
  currencyField,
  departmentField,
  levelField,
  viewField,
} from '../../validation/filterFields.js';
import { pageField, pageSizeField } from '../../validation/pagination.js';

const SEARCH_MAX_LENGTH = 100;

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

  country: countryField,
  department: departmentField,
  level: levelField,
  status: z.enum(EMPLOYMENT_STATUSES, { error: 'Status must be ACTIVE or INACTIVE.' }).optional(),
  currency: currencyField,

  /** R-31: only these columns can be sorted by. */
  sortBy: z
    .enum(EMPLOYEE_SORT_COLUMNS, {
      error: `Sort column must be one of: ${EMPLOYEE_SORT_COLUMNS.join(', ')}.`,
    })
    .default('fullName'),
  sortDir: z.enum(SORT_DIRECTIONS, { error: 'Sort direction must be asc or desc.' }).default('asc'),
  view: viewField,

  page: pageField,
  pageSize: pageSizeField,
});

/** A checked list request, as the service and the repository receive it. */
export type ListEmployeesQuery = z.output<typeof employeeListQuerySchema>;
