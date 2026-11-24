import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { employeeListQuerySchema } from './employeeList.schema.js';

/** "field: message" lines for every problem, so a test can compare them at a glance. */
function problemsOf(query: unknown): string[] {
  try {
    employeeListQuerySchema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    }
    throw error;
  }
  return [];
}

describe('employeeListQuerySchema', () => {
  it('uses sensible defaults when nothing is given', () => {
    expect(employeeListQuerySchema.parse({})).toEqual({
      sortBy: 'fullName',
      sortDir: 'asc',
      view: 'local',
      page: 1,
      pageSize: 25,
    });
  });

  it('turns every parameter from URL text into the right type', () => {
    const query = employeeListQuerySchema.parse({
      q: 'pri',
      country: 'IN',
      department: 'Engineering',
      level: 'L3',
      status: 'ACTIVE',
      currency: 'INR',
      sortBy: 'salary',
      sortDir: 'desc',
      view: 'usd',
      page: '2',
      pageSize: '50',
    });

    expect(query).toEqual({
      q: 'pri',
      country: 'IN',
      department: 'Engineering',
      level: 'L3',
      status: 'ACTIVE',
      currency: 'INR',
      sortBy: 'salary',
      sortDir: 'desc',
      view: 'usd',
      page: 2,
      pageSize: 50,
    });
  });

  describe('R-30: paging', () => {
    it('rejects a page size above 100', () => {
      expect(problemsOf({ pageSize: '101' })).toEqual([
        'pageSize: Page size must be a whole number from 1 to 100.',
      ]);
    });

    it('rejects page 0', () => {
      expect(problemsOf({ page: '0' })).toEqual([
        'page: Page must be a whole number of 1 or more.',
      ]);
    });
  });

  describe('q (text search)', () => {
    it('trims the text', () => {
      expect(employeeListQuerySchema.parse({ q: '  priya  ' }).q).toBe('priya');
    });

    it('treats blank text as "no search", so an emptied search box shows everyone', () => {
      expect(employeeListQuerySchema.parse({ q: '' }).q).toBeUndefined();
      expect(employeeListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
    });

    it('accepts exactly 100 characters and rejects 101', () => {
      expect(problemsOf({ q: 'a'.repeat(100) })).toEqual([]);
      expect(problemsOf({ q: 'a'.repeat(101) })).toEqual([
        'q: Search text must be at most 100 characters.',
      ]);
    });

    it('rejects a repeated parameter such as ?q=a&q=b', () => {
      expect(problemsOf({ q: ['a', 'b'] })).toEqual([
        'q: Search text must be given once, as text.',
      ]);
    });

    it('keeps characters that are special in SQL, because they are escaped later', () => {
      expect(employeeListQuerySchema.parse({ q: "50%_o'x\\" }).q).toBe("50%_o'x\\");
    });
  });

  describe('filters', () => {
    it.each(['XX', 'in', 'India', ''])('rejects the country "%s"', (country) => {
      expect(problemsOf({ country })).toEqual(['country: Country is not supported.']);
    });

    it.each(['L0', 'L7', 'l3', ''])('rejects the level "%s"', (level) => {
      expect(problemsOf({ level })).toEqual(['level: Level must be one of L1 to L6.']);
    });

    it.each(['DELETED', 'active', ''])('rejects the status "%s"', (status) => {
      expect(problemsOf({ status })).toEqual(['status: Status must be ACTIVE or INACTIVE.']);
    });

    it.each(['ZZZ', 'inr', 'US', ''])('rejects the currency "%s"', (currency) => {
      expect(problemsOf({ currency })).toEqual(['currency: Currency is not supported.']);
    });

    it('accepts every currency used by a supported country', () => {
      for (const currency of ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'BRL']) {
        expect(problemsOf({ currency })).toEqual([]);
      }
    });

    it('rejects an empty or over-long department', () => {
      expect(problemsOf({ department: '' })).toEqual(['department: Department must not be empty.']);
      expect(problemsOf({ department: 'd'.repeat(61) })).toEqual([
        'department: Department must be at most 60 characters.',
      ]);
    });

    it.each(['country', 'level', 'status', 'currency', 'department'])(
      'rejects a repeated %s parameter instead of silently using one of the values',
      (name) => {
        const problems = problemsOf({ [name]: ['IN', 'US'] });

        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(new RegExp(`^${name}: `));
      },
    );
  });

  describe('R-31: sorting uses an allow-list', () => {
    it.each(['fullName', 'employeeCode', 'salary', 'hireDate', 'department', 'country', 'level'])(
      'accepts the column %s',
      (sortBy) => {
        expect(problemsOf({ sortBy })).toEqual([]);
      },
    );

    it.each([
      'password',
      'full_name',
      'FULLNAME',
      'id',
      'fullName; DROP TABLE employees',
      'fullName,id',
      "name' OR '1'='1",
      '',
    ])('rejects the column "%s"', (sortBy) => {
      expect(problemsOf({ sortBy })).toEqual([
        'sortBy: Sort column must be one of: fullName, employeeCode, salary, hireDate, department, country, level.',
      ]);
    });

    it.each(['sideways', 'ASC', 'DESC', 'asc; DROP TABLE x', ''])(
      'rejects the direction "%s"',
      (sortDir) => {
        expect(problemsOf({ sortDir })).toEqual(['sortDir: Sort direction must be asc or desc.']);
      },
    );
  });

  it.each(['local', 'usd'])('accepts the view %s', (view) => {
    expect(problemsOf({ view })).toEqual([]);
  });

  it.each(['USD', 'eur', ''])('rejects the view "%s"', (view) => {
    expect(problemsOf({ view })).toEqual(['view: View must be local or usd.']);
  });

  it('R-34: reports every unknown parameter, so a typo is caught early', () => {
    const result = employeeListQuerySchema.safeParse({ pagesize: '5', Country: 'IN' });

    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({
      code: 'unrecognized_keys',
      keys: ['pagesize', 'Country'],
    });
  });
});
