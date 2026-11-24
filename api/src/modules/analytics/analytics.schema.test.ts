import { describe, expect, it } from 'vitest';
import { ZodError, type ZodType } from 'zod';
import {
  analyticsFilterSchema,
  distributionQuerySchema,
  extremesQuerySchema,
  recentChangesQuerySchema,
} from './analytics.schema.js';

function problemsOf(schema: ZodType, query: unknown): string[] {
  try {
    schema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    }
    throw error;
  }
  return [];
}

describe('analyticsFilterSchema', () => {
  it('counts only active employees in the local view by default (R-40)', () => {
    expect(analyticsFilterSchema.parse({})).toEqual({ status: 'ACTIVE', view: 'local' });
  });

  it('accepts every filter', () => {
    const filters = analyticsFilterSchema.parse({
      country: 'IN',
      department: 'Engineering',
      level: 'L3',
      status: 'ALL',
      view: 'usd',
    });

    expect(filters).toEqual({
      country: 'IN',
      department: 'Engineering',
      level: 'L3',
      status: 'ALL',
      view: 'usd',
    });
  });

  it.each(['ACTIVE', 'INACTIVE', 'ALL'])('accepts the status %s', (status) => {
    expect(problemsOf(analyticsFilterSchema, { status })).toEqual([]);
  });

  it.each(['active', 'DELETED', ''])('rejects the status "%s"', (status) => {
    expect(problemsOf(analyticsFilterSchema, { status })).toEqual([
      'status: Status must be ACTIVE, INACTIVE or ALL.',
    ]);
  });

  it('uses the same messages as the employee list for the shared filters', () => {
    expect(
      problemsOf(analyticsFilterSchema, {
        country: 'XX',
        level: 'L9',
        view: 'euro',
        department: '',
      }),
    ).toEqual([
      'country: Country is not supported.',
      'department: Department must not be empty.',
      'level: Level must be one of L1 to L6.',
      'view: View must be local or usd.',
    ]);
  });

  it('rejects a repeated parameter', () => {
    expect(problemsOf(analyticsFilterSchema, { country: ['IN', 'US'] })).toHaveLength(1);
  });

  it('rejects parameters it does not know, such as the employee-list ones', () => {
    const result = analyticsFilterSchema.safeParse({ page: '1', sortBy: 'salary' });

    expect(result.error?.issues[0]).toMatchObject({
      code: 'unrecognized_keys',
      keys: ['page', 'sortBy'],
    });
  });
});

describe('distributionQuerySchema', () => {
  it('uses 10 buckets by default and needs no currency to parse (the service decides)', () => {
    expect(distributionQuerySchema.parse({})).toMatchObject({ buckets: 10, view: 'local' });
  });

  it('accepts a currency and the shared filters', () => {
    const query = distributionQuerySchema.parse({ currency: 'INR', country: 'IN', buckets: '12' });

    expect(query).toMatchObject({ currency: 'INR', country: 'IN', buckets: 12 });
  });

  it.each(['5', '30'])('accepts %s buckets', (buckets) => {
    expect(problemsOf(distributionQuerySchema, { buckets })).toEqual([]);
  });

  it.each(['4', '31', '0', '-5', 'abc', '', '10.5', '1e1'])('rejects %s buckets', (buckets) => {
    expect(problemsOf(distributionQuerySchema, { buckets })).toEqual([
      'buckets: Buckets must be a whole number from 5 to 30.',
    ]);
  });

  it('rejects an unknown currency', () => {
    expect(problemsOf(distributionQuerySchema, { currency: 'ZZZ' })).toEqual([
      'currency: Currency is not supported.',
    ]);
  });
});

describe('extremesQuerySchema', () => {
  it('lists 10 people by default', () => {
    expect(extremesQuerySchema.parse({})).toMatchObject({ limit: 10 });
  });

  it.each(['1', '25'])('accepts the limit %s', (limit) => {
    expect(problemsOf(extremesQuerySchema, { limit })).toEqual([]);
  });

  it.each(['0', '26', '-1', 'abc', '', '2.5'])('rejects the limit %s', (limit) => {
    expect(problemsOf(extremesQuerySchema, { limit })).toEqual([
      'limit: Limit must be a whole number from 1 to 25.',
    ]);
  });
});

describe('recentChangesQuerySchema', () => {
  it('lists 10 changes by default', () => {
    expect(recentChangesQuerySchema.parse({})).toEqual({ limit: 10 });
  });

  it('accepts a limit from 1 to 25', () => {
    expect(recentChangesQuerySchema.parse({ limit: '25' })).toEqual({ limit: 25 });
    expect(problemsOf(recentChangesQuerySchema, { limit: '26' })).toHaveLength(1);
  });

  it('does not take the analytics filters', () => {
    const result = recentChangesQuerySchema.safeParse({ country: 'IN' });

    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['country'] });
  });
});
