import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { pagingQuerySchema } from './pagination.js';

function problemsOf(query: unknown): string[] {
  try {
    pagingQuerySchema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    }
    throw error;
  }
  return [];
}

describe('pagingQuerySchema (R-30)', () => {
  it('defaults to page 1 with 25 rows', () => {
    expect(pagingQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  it('turns the text from the URL into numbers', () => {
    expect(pagingQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('accepts the smallest and largest page size', () => {
    expect(pagingQuerySchema.parse({ pageSize: '1' }).pageSize).toBe(1);
    expect(pagingQuerySchema.parse({ pageSize: '100' }).pageSize).toBe(100);
  });

  it.each(['0', '101', '-1', '1.5', 'abc', '', ' 5', '1e2', '5 '])(
    'rejects the page size "%s"',
    (pageSize) => {
      expect(problemsOf({ pageSize })).toEqual([
        'pageSize: Page size must be a whole number from 1 to 100.',
      ]);
    },
  );

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999'])('rejects the page "%s"', (page) => {
    expect(problemsOf({ page })).toEqual(['page: Page must be a whole number of 1 or more.']);
  });

  it('rejects a repeated parameter such as ?page=1&page=2', () => {
    expect(problemsOf({ page: ['1', '2'] })).toEqual([
      'page: Page must be a whole number of 1 or more.',
    ]);
  });

  it('rejects parameters it does not know, so typos are caught early', () => {
    expect(problemsOf({ pagesize: '5' })).toHaveLength(1);
  });
});
