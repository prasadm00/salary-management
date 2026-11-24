import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_EMPLOYEES, seedEmployees } from '../../tests/seedEmployees.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app, prisma } = context;

// The list is only read in these tests, so the sample data is loaded once.
beforeAll(async () => {
  await context.reset();
  await seedEmployees(prisma, SAMPLE_EMPLOYEES);
});
afterAll(async () => {
  await context.reset();
  await context.close();
});

const list = (query = '') => request(app).get(`/api/employees${query}`);
const idsOf = (response: { body: { data: { id: number }[] } }) =>
  response.body.data.map((row) => row.id);

describe('GET /api/employees: the response', () => {
  it('returns the standard paged shape with full employee objects', async () => {
    const response = await list();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 1, pageSize: 25, total: 8 });
    expect(response.body.data).toHaveLength(8);
    expect(response.body.data[0]).toEqual({
      id: 1,
      employeeCode: 'EMP-000001',
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      department: 'Engineering',
      jobTitle: 'Specialist',
      level: 'L3',
      country: 'IN',
      employmentStatus: 'ACTIVE',
      hireDate: '2021-04-12',
      compensation: { amount: '2400000.00', currency: 'INR', effectiveDate: '2021-04-12' },
      createdAt: expect.stringMatching(/Z$/),
      updatedAt: expect.stringMatching(/Z$/),
    });
  });

  it('sends money as text with two decimals, never as a number', async () => {
    const response = await list();

    for (const row of response.body.data) {
      expect(typeof row.compensation.amount).toBe('string');
      expect(row.compensation.amount).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it('includes inactive employees unless a status is chosen', async () => {
    const response = await list();

    expect(idsOf(response)).toContain(4);
  });
});

describe('5D.1 paging (R-30)', () => {
  it('uses page 1 and 25 rows by default', async () => {
    const response = await list();

    expect(response.body).toMatchObject({ page: 1, pageSize: 25 });
  });

  it('returns the requested number of rows and the total of all matches', async () => {
    const response = await list('?pageSize=3');

    expect(response.body.data).toHaveLength(3);
    expect(response.body).toMatchObject({ page: 1, pageSize: 3, total: 8 });
  });

  it('walks through every page without repeating or skipping anyone', async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => list(`?pageSize=3&page=${page}`)));

    expect(pages.map((page) => page.body.data.length)).toEqual([3, 3, 2]);
    expect(pages.flatMap(idsOf)).toEqual([1, 5, 3, 4, 2, 6, 7, 8]);
  });

  it('returns an empty list with the correct total for a page past the end', async () => {
    const response = await list('?page=99');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], page: 99, pageSize: 25, total: 8 });
  });

  it('accepts the largest page size, 100', async () => {
    const response = await list('?pageSize=100');

    expect(response.status).toBe(200);
    expect(response.body.pageSize).toBe(100);
  });

  it.each(['101', '0', '-1', 'abc', '2.5', '1e2'])(
    'rejects the page size %s with a clear message',
    async (size) => {
      const response = await list(`?pageSize=${size}`);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'pageSize', message: 'Page size must be a whole number from 1 to 100.' },
      ]);
    },
  );

  it.each(['0', '-1', 'abc', '1.5'])('rejects the page %s', async (page) => {
    const response = await list(`?page=${page}`);

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].field).toBe('page');
  });
});

describe('5D.2 filters', () => {
  it.each([
    ['country=IN', [1, 2, 6]],
    ['country=US', [3, 4, 7, 8]],
    ['country=DE', [5]],
    ['department=Engineering', [1, 5, 2]],
    ['department=Sales', [3, 6]],
    ['level=L3', [1, 6]],
    ['level=L1', [4, 8]],
    ['status=INACTIVE', [4]],
    ['status=ACTIVE', [1, 5, 3, 2, 6, 7, 8]],
    ['currency=INR', [1, 2, 6]],
    ['currency=EUR', [5]],
  ])('filters by %s', async (filter, expectedIds) => {
    const response = await list(`?${filter}`);

    expect(response.status).toBe(200);
    expect(idsOf(response)).toEqual(expectedIds);
    expect(response.body.total).toBe(expectedIds.length);
  });

  it.each([
    ['country=IN&department=Engineering', [1, 2]],
    ['country=IN&department=Sales&level=L3', [6]],
    ['country=US&status=INACTIVE', [4]],
    ['country=US&status=ACTIVE&level=L1', [8]],
    ['department=Engineering&level=L5&currency=EUR', [5]],
  ])('combines filters with AND: %s', async (filter, expectedIds) => {
    const response = await list(`?${filter}`);

    expect(idsOf(response)).toEqual(expectedIds);
  });

  it('combines a filter with the text search', async () => {
    const response = await list('?country=IN&q=priya');

    expect(idsOf(response)).toEqual([2, 6]);
  });

  it('returns an empty list, not an error, when nobody matches', async () => {
    const response = await list('?country=DE&department=Sales');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: [], total: 0 });
  });

  it('keeps the total in step with the filter while paging', async () => {
    const response = await list('?country=US&pageSize=2&page=2');

    expect(response.body).toMatchObject({ page: 2, pageSize: 2, total: 4 });
    expect(idsOf(response)).toEqual([7, 8]);
  });

  it.each([
    ['country=XX', 'country', 'Country is not supported.'],
    ['country=in', 'country', 'Country is not supported.'],
    ['level=L9', 'level', 'Level must be one of L1 to L6.'],
    ['status=DELETED', 'status', 'Status must be ACTIVE or INACTIVE.'],
    ['currency=ZZZ', 'currency', 'Currency is not supported.'],
    ['department=', 'department', 'Department must not be empty.'],
    ['country=IN&country=US', 'country', 'Country is not supported.'],
  ])('rejects %s', async (filter, field, message) => {
    const response = await list(`?${filter}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([{ field, message }]);
  });

  it('R-34: rejects a parameter it does not know', async () => {
    const response = await list('?pagesize=5');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: 'pagesize', message: 'This field is not allowed.' },
    ]);
  });
});

describe('5D.3 text search', () => {
  it.each([
    ['priya', [2, 6]],
    ['PRIYA', [2, 6]],
    ['PrIyA', [2, 6]],
    ['pri', [2, 6]],
    ['riya', [2, 6]],
    ['carter', [3]],
    ['Liam Carter', [3]],
    ['liam.carter@acme.example', [3]],
    ['hans.mueller', [5]],
    ['EMP-000003', [3]],
    ['emp-000003', [3]],
    ['000003', [3]],
    ['müller', [5]],
  ])('finds "%s" by name, email or code, whatever the letter case', async (q, expectedIds) => {
    const response = await list(`?q=${encodeURIComponent(q)}`);

    expect(response.status).toBe(200);
    expect(idsOf(response)).toEqual(expectedIds);
  });

  it('matches part of a word in the middle, not only the start', async () => {
    const response = await list('?q=iyank');

    expect(idsOf(response)).toEqual([6]);
  });

  it('ignores spaces around the search text', async () => {
    const response = await list(`?q=${encodeURIComponent('   priya  ')}`);

    expect(idsOf(response)).toEqual([2, 6]);
  });

  it('shows everyone when the search text is blank', async () => {
    const response = await list('?q=%20%20');

    expect(response.body.total).toBe(8);
  });

  it('answers 200 with an empty list when nothing matches, so the UI can show an empty state', async () => {
    const response = await list('?q=zzzzzz');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: [], total: 0 });
  });

  it('reports the total of the search, and pages through it', async () => {
    const response = await list('?q=priya&pageSize=1&page=2');

    expect(response.body).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(idsOf(response)).toEqual([6]);
  });

  describe('special characters are searched for literally, never as wildcards', () => {
    it('"%" matches nothing here, instead of matching everyone', async () => {
      const response = await list('?q=%25');

      expect(response.body.total).toBe(0);
    });

    it('"_" matches only the value with a real underscore, not any single character', async () => {
      const response = await list('?q=_');

      expect(idsOf(response)).toEqual([7]);
    });

    it('"sam_lee" does not match "samxlee"', async () => {
      const response = await list('?q=sam_lee');

      expect(idsOf(response)).toEqual([7]);
    });

    it('a backslash does not break the query', async () => {
      const response = await list('?q=%5C');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('a quote and SQL words are just text: this finds nothing and changes nothing', async () => {
      const response = await list(`?q=${encodeURIComponent("'; DROP TABLE employees; --")}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
      expect(await prisma.employee.count()).toBe(8);
    });
  });

  it('rejects search text longer than 100 characters', async () => {
    const response = await list(`?q=${'a'.repeat(101)}`);

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: 'q', message: 'Search text must be at most 100 characters.' },
    ]);
  });
});

describe('5D.4 sorting (R-31, R-33)', () => {
  it.each([
    ['sortBy=fullName', [1, 5, 3, 4, 2, 6, 7, 8]],
    ['sortBy=fullName&sortDir=desc', [8, 7, 6, 2, 4, 3, 5, 1]],
    ['sortBy=employeeCode&sortDir=desc', [8, 7, 6, 5, 4, 3, 2, 1]],
    ['sortBy=hireDate', [8, 5, 3, 6, 1, 2, 4, 7]],
    ['sortBy=hireDate&sortDir=desc', [7, 4, 2, 1, 6, 3, 5, 8]],
    ['sortBy=country', [5, 1, 2, 6, 3, 4, 7, 8]],
    ['sortBy=department', [1, 2, 5, 3, 6, 4, 7, 8]],
    ['sortBy=level', [4, 8, 2, 7, 1, 6, 3, 5]],
  ])('sorts by %s', async (sort, expectedIds) => {
    const response = await list(`?${sort}`);

    expect(response.status).toBe(200);
    expect(idsOf(response)).toEqual(expectedIds);
  });

  it('breaks ties by id in ascending order, whatever the direction (stable paging)', async () => {
    const response = await list('?sortBy=level&sortDir=desc');

    // L5: 5 | L4: 3 | L3: 1, 6 | L2: 2, 7 | L1: 4, 8
    expect(idsOf(response)).toEqual([5, 3, 1, 6, 2, 7, 4, 8]);
  });

  it('pages a sort full of ties without repeating or skipping anyone', async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map((page) => list(`?sortBy=country&pageSize=2&page=${page}`)),
    );

    expect(pages.flatMap(idsOf)).toEqual([5, 1, 2, 6, 3, 4, 7, 8]);
  });

  it('keeps the filters while sorting', async () => {
    const response = await list('?country=IN&sortBy=hireDate&sortDir=desc');

    expect(idsOf(response)).toEqual([2, 1, 6]);
  });

  describe('R-32: sorting by salary', () => {
    it('is refused across currencies, with advice on what to do', async () => {
      const response = await list('?sortBy=salary');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        {
          field: 'sortBy',
          message: 'Choose a currency or switch to the USD view to sort by salary.',
        },
      ]);
    });

    it('is refused when only a country is chosen', async () => {
      const response = await list('?sortBy=salary&country=IN');

      expect(response.status).toBe(400);
    });

    it('works within one currency, highest first', async () => {
      const response = await list('?sortBy=salary&sortDir=desc&currency=INR');

      expect(idsOf(response)).toEqual([1, 6, 2]);
    });

    it('works within one currency, lowest first', async () => {
      const response = await list('?sortBy=salary&currency=USD');

      expect(idsOf(response)).toEqual([4, 7, 8, 3]);
    });

    it('works across currencies in the USD view, using the fixed rates', async () => {
      const response = await list('?sortBy=salary&view=usd');

      // 14,400 | 21,600 | 28,800 | 42,000 | 50,000 | 60,000 | 95,000 | 97,200
      expect(idsOf(response)).toEqual([2, 6, 1, 4, 7, 8, 3, 5]);
    });

    it('reverses the USD order for descending', async () => {
      const response = await list('?sortBy=salary&view=usd&sortDir=desc');

      expect(idsOf(response)).toEqual([5, 3, 8, 7, 4, 1, 6, 2]);
    });

    it('differs from comparing raw amounts, where 2,400,000 INR would beat every dollar salary', async () => {
      const usd = await list('?sortBy=salary&view=usd&sortDir=desc');

      expect(idsOf(usd)[0]).toBe(5);
      expect(idsOf(usd)[0]).not.toBe(1);
    });

    it('does not change which people are listed, only their order', async () => {
      const local = await list('?view=local');
      const usd = await list('?view=usd');

      expect(local.body.total).toBe(usd.body.total);
    });
  });

  describe('an unknown sort column is refused, so it can never reach the SQL', () => {
    it.each([
      'password',
      'full_name',
      'id',
      'fullName;DROP TABLE employees',
      "fullName'--",
      '(SELECT 1)',
    ])('rejects sortBy=%s', async (sortBy) => {
      const response = await list(`?sortBy=${encodeURIComponent(sortBy)}`);

      expect(response.status).toBe(400);
      expect(response.body.error.details[0]).toMatchObject({ field: 'sortBy' });
      expect(await prisma.employee.count()).toBe(8);
    });

    it.each(['sideways', 'ASC', 'asc;DROP TABLE employees'])(
      'rejects sortDir=%s',
      async (sortDir) => {
        const response = await list(`?sortDir=${encodeURIComponent(sortDir)}`);

        expect(response.status).toBe(400);
        expect(response.body.error.details).toEqual([
          { field: 'sortDir', message: 'Sort direction must be asc or desc.' },
        ]);
        expect(await prisma.employee.count()).toBe(8);
      },
    );

    it('rejects an unknown view', async () => {
      const response = await list('?view=euro');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'view', message: 'View must be local or usd.' },
      ]);
    });
  });
});

describe('error responses stay clean', () => {
  it('never leaks SQL, table names or stack traces', async () => {
    const response = await list('?sortBy=nope&country=XX&pageSize=500');

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toMatch(
      /select|from employees|prisma|stack|at \w+\./i,
    );
  });
});
