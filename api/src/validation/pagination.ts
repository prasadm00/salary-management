import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1_000_000;

const PAGE_MESSAGE = 'Page must be a whole number of 1 or more.';
const PAGE_SIZE_MESSAGE = `Page size must be a whole number from 1 to ${MAX_PAGE_SIZE}.`;

/** Plain digits only, so "1e2", " 5" and "5.0" are refused. Query values arrive as text. */
function wholeNumber(message: string, max: number) {
  return z
    .string({ error: message })
    .regex(/^[1-9]\d{0,9}$/, { error: message })
    .transform(Number)
    .refine((value) => value <= max, { error: message });
}

/** The `page` parameter: starts at 1. Reused by every list endpoint. */
export const pageField = wholeNumber(PAGE_MESSAGE, MAX_PAGE).default(1);

/** The `pageSize` parameter: 1 to 100, defaults to 25. Reused by every list endpoint. */
export const pageSizeField = wholeNumber(PAGE_SIZE_MESSAGE, MAX_PAGE_SIZE).default(
  DEFAULT_PAGE_SIZE,
);

/**
 * The `page` and `pageSize` query parameters (R-30).
 * Unknown parameters are rejected, so a typo such as `?pagesize=5` is caught.
 */
export const pagingQuerySchema = z.strictObject({
  page: pageField,
  pageSize: pageSizeField,
});

export type PagingQuery = z.output<typeof pagingQuerySchema>;
