import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_EMPLOYEES, seedEmployees } from '../../tests/seedEmployees.js';
import { createTestContext } from '../../tests/testApp.js';

/**
 * Every figure below was worked out by hand from the 8 people in SAMPLE_EMPLOYEES
 * (see the table in tests/seedEmployees.ts). Mia Lopez (id 4) is INACTIVE, so she is
 * left out unless `status` says otherwise.
 *
 *   EUR  active: 90,000
 *   INR  active: 1,200,000  1,800,000  2,400,000
 *   USD  active: 50,000  60,000  95,000        (with Mia: 42,000 50,000 60,000 95,000)
 */
const context = createTestContext();
const { app, prisma } = context;

beforeAll(async () => {
  await context.reset();
  await seedEmployees(prisma, SAMPLE_EMPLOYEES);
});
afterAll(async () => {
  await context.reset();
  await context.close();
});

const get = (path: string) => request(app).get(`/api/analytics${path}`);

/** All seven numbers the same, for a group of one person. */
const single = (currency: string, amount: string) => ({
  currency,
  headcount: 1,
  min: amount,
  max: amount,
  average: amount,
  median: amount,
  p25: amount,
  p75: amount,
});

const EUR_ACTIVE = single('EUR', '90000.00');
const INR_ACTIVE = {
  currency: 'INR',
  headcount: 3,
  min: '1200000.00',
  max: '2400000.00',
  average: '1800000.00',
  median: '1800000.00',
  p25: '1200000.00',
  p75: '2400000.00',
};
const USD_ACTIVE = {
  currency: 'USD',
  headcount: 3,
  min: '50000.00',
  max: '95000.00',
  average: '68333.33', // 205,000 / 3 = 68,333.333...
  median: '60000.00',
  p25: '50000.00',
  p75: '95000.00',
};

describe('GET /api/analytics/summary (5E.2)', () => {
  it('gives one group per currency with exact statistics, and counts only active people by default', async () => {
    const response = await get('/summary');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      view: 'local',
      headcount: 7,
      groups: [EUR_ACTIVE, INR_ACTIVE, USD_ACTIVE],
    });
  });

  it('R-35: never combines currencies, so the group headcounts add up to the total', async () => {
    const { body } = await get('/summary');

    const sum = body.groups.reduce(
      (total: number, group: { headcount: number }) => total + group.headcount,
      0,
    );
    expect(sum).toBe(body.headcount);
    expect(body.groups.map((group: { currency: string }) => group.currency)).toEqual([
      'EUR',
      'INR',
      'USD',
    ]);
  });

  it('sends every amount as text with two decimals, never as a number', async () => {
    const { body } = await get('/summary');

    for (const group of body.groups) {
      for (const field of ['min', 'max', 'average', 'median', 'p25', 'p75']) {
        expect(typeof group[field]).toBe('string');
        expect(group[field]).toMatch(/^\d+\.\d{2}$/);
      }
    }
  });

  it('R-36: the median of an even number of salaries is the average of the two in the middle', async () => {
    // USD with Mia: 42,000  50,000  60,000  95,000  ->  middle two are 50,000 and 60,000
    const response = await get('/summary?status=ALL');

    expect(response.body.headcount).toBe(8);
    expect(
      response.body.groups.find((group: { currency: string }) => group.currency === 'USD'),
    ).toEqual({
      currency: 'USD',
      headcount: 4,
      min: '42000.00',
      max: '95000.00',
      average: '61750.00', // 247,000 / 4
      median: '55000.00',
      p25: '42000.00', // rank ceil(0.25 x 4) = 1
      p75: '60000.00', // rank ceil(0.75 x 4) = 3
    });
  });

  it('R-36: the median of an odd number of salaries is the one in the middle', async () => {
    const response = await get('/summary?country=IN');

    expect(response.body.groups).toEqual([INR_ACTIVE]);
  });

  it('R-37: quartiles use the nearest-rank method, which always returns a real salary', async () => {
    // INR level L3 and country IN: 1,800,000 and 2,400,000 -> p25 rank 1, p75 rank 2
    const response = await get('/summary?country=IN&level=L3');

    expect(response.body.groups).toEqual([
      {
        currency: 'INR',
        headcount: 2,
        min: '1800000.00',
        max: '2400000.00',
        average: '2100000.00',
        median: '2100000.00',
        p25: '1800000.00',
        p75: '2400000.00',
      },
    ]);
  });

  it('a group of one person has the same figure everywhere', async () => {
    const response = await get('/summary?country=DE');

    expect(response.body.groups).toEqual([EUR_ACTIVE]);
  });

  describe('filters (5E.3)', () => {
    it.each([
      ['country=US', 3, ['USD']],
      ['department=Engineering', 3, ['EUR', 'INR']],
      ['level=L2', 2, ['INR', 'USD']],
      ['country=IN&department=Sales', 1, ['INR']],
      ['status=INACTIVE', 1, ['USD']],
    ])('applies %s', async (filter, headcount, currencies) => {
      const response = await get(`/summary?${filter}`);

      expect(response.status).toBe(200);
      expect(response.body.headcount).toBe(headcount);
      expect(response.body.groups.map((group: { currency: string }) => group.currency)).toEqual(
        currencies,
      );
    });

    it('status=ALL includes inactive people', async () => {
      const response = await get('/summary?status=ALL&country=US');

      expect(response.body.headcount).toBe(4);
    });

    it('R-39: returns an empty list, not an error or a division by zero, when nobody matches', async () => {
      const response = await get('/summary?country=DE&department=Sales');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ view: 'local', headcount: 0, groups: [] });
    });
  });

  describe('the USD view (5E.5, US-13)', () => {
    // Converted with 1 INR = 0.012 USD and 1 EUR = 1.08 USD, sorted:
    // 14,400  21,600  28,800  50,000  60,000  95,000  97,200
    it('converts every salary with the fixed rates and reports one USD group', async () => {
      const response = await get('/summary?view=usd');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        view: 'usd',
        ratesAsOf: '2026-01-01',
        ratesNote: 'Fixed, illustrative exchange rates. Not live market data.',
        headcount: 7,
        groups: [
          {
            currency: 'USD',
            headcount: 7,
            min: '14400.00',
            max: '97200.00',
            average: '52428.57', // 367,000 / 7 = 52,428.571...
            median: '50000.00', // 4th of 7
            p25: '21600.00', // rank ceil(0.25 x 7) = 2
            p75: '95000.00', // rank ceil(0.75 x 7) = 6
          },
        ],
      });
    });

    it('is labelled with the date of the rates, so nobody mistakes them for live prices', async () => {
      const response = await get('/summary?view=usd');

      expect(response.body.ratesAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(response.body.ratesNote).toMatch(/illustrative/i);
    });

    it('does not label the local view', async () => {
      const response = await get('/summary?view=local');

      expect(response.body).not.toHaveProperty('ratesAsOf');
      expect(response.body).not.toHaveProperty('ratesNote');
    });

    it('lists the same people in both views', async () => {
      const local = await get('/summary');
      const usd = await get('/summary?view=usd');

      expect(usd.body.headcount).toBe(local.body.headcount);
    });

    it('applies the filters in the USD view too', async () => {
      const response = await get('/summary?view=usd&country=IN');

      // 14,400  21,600  28,800
      expect(response.body.groups).toEqual([
        {
          currency: 'USD',
          headcount: 3,
          min: '14400.00',
          max: '28800.00',
          average: '21600.00',
          median: '21600.00',
          p25: '14400.00',
          p75: '28800.00',
        },
      ]);
    });
  });
});

describe('GET /api/analytics/by-country (5E.1, 5E.3)', () => {
  it('gives headcount and statistics for each country, in its own currency', async () => {
    const response = await get('/by-country');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      view: 'local',
      groupBy: 'country',
      headcount: 7,
      rows: [
        { key: 'DE', ...EUR_ACTIVE },
        { key: 'IN', ...INR_ACTIVE },
        { key: 'US', ...USD_ACTIVE },
      ],
    });
  });

  it('the row headcounts add up to the total', async () => {
    const { body } = await get('/by-country');

    const sum = body.rows.reduce(
      (total: number, row: { headcount: number }) => total + row.headcount,
      0,
    );
    expect(sum).toBe(body.headcount);
  });

  it('in the USD view each country has one row in dollars', async () => {
    const response = await get('/by-country?view=usd');

    expect(response.body.ratesAsOf).toBe('2026-01-01');
    expect(
      response.body.rows.map((row: { key: string; currency: string; median: string }) => [
        row.key,
        row.currency,
        row.median,
      ]),
    ).toEqual([
      ['DE', 'USD', '97200.00'],
      ['IN', 'USD', '21600.00'],
      ['US', 'USD', '60000.00'],
    ]);
  });
});

describe('GET /api/analytics/by-department (5E.1, 5E.3)', () => {
  const summary = (row: { key: string; currency: string; headcount: number }) => [
    row.key,
    row.currency,
    row.headcount,
  ];

  it('gives a separate row for each currency inside a department, so currencies are never mixed', async () => {
    const response = await get('/by-department');

    expect(response.body.groupBy).toBe('department');
    expect(response.body.rows.map(summary)).toEqual([
      ['Engineering', 'EUR', 1],
      ['Engineering', 'INR', 2],
      ['Sales', 'INR', 1],
      ['Sales', 'USD', 1],
      ['Support', 'USD', 2],
    ]);
  });

  it('computes the statistics inside each department and currency', async () => {
    const response = await get('/by-department');

    const find = (key: string, currency: string) =>
      response.body.rows.find(
        (row: { key: string; currency: string }) => row.key === key && row.currency === currency,
      );
    expect(find('Engineering', 'INR')).toEqual({
      key: 'Engineering',
      currency: 'INR',
      headcount: 2,
      min: '1200000.00',
      max: '2400000.00',
      average: '1800000.00',
      median: '1800000.00',
      p25: '1200000.00',
      p75: '2400000.00',
    });
    expect(find('Support', 'USD')).toEqual({
      key: 'Support',
      currency: 'USD',
      headcount: 2,
      min: '50000.00',
      max: '60000.00',
      average: '55000.00',
      median: '55000.00',
      p25: '50000.00',
      p75: '60000.00',
    });
  });

  it('the filters narrow the rows', async () => {
    const response = await get('/by-department?country=IN');

    expect(response.body.headcount).toBe(3);
    expect(response.body.rows.map(summary)).toEqual([
      ['Engineering', 'INR', 2],
      ['Sales', 'INR', 1],
    ]);
  });

  it('in the USD view each department has one row', async () => {
    const response = await get('/by-department?view=usd');

    expect(response.body.rows.map(summary)).toEqual([
      ['Engineering', 'USD', 3],
      ['Sales', 'USD', 2],
      ['Support', 'USD', 2],
    ]);
  });

  it('lists nothing for a department nobody works in, and does not fail', async () => {
    const response = await get('/by-department?department=Legal');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ headcount: 0, rows: [] });
  });
});

describe('GET /api/analytics/by-level (5E.1, 5E.3)', () => {
  it('gives headcount per level, split by currency, in level order', async () => {
    const response = await get('/by-level');

    expect(response.body.groupBy).toBe('level');
    expect(
      response.body.rows.map((row: { key: string; currency: string; headcount: number }) => [
        row.key,
        row.currency,
        row.headcount,
      ]),
    ).toEqual([
      ['L1', 'USD', 1], // Mia is inactive, so only SamxLee
      ['L2', 'INR', 1],
      ['L2', 'USD', 1],
      ['L3', 'INR', 2],
      ['L4', 'USD', 1],
      ['L5', 'EUR', 1],
    ]);
  });

  it('includes inactive people when asked, which changes the L1 figures', async () => {
    const response = await get('/by-level?status=ALL&level=L1');

    expect(response.body.rows).toEqual([
      {
        key: 'L1',
        currency: 'USD',
        headcount: 2,
        min: '42000.00',
        max: '60000.00',
        average: '51000.00',
        median: '51000.00',
        p25: '42000.00',
        p75: '60000.00',
      },
    ]);
  });
});

describe('analytics input checking', () => {
  it.each([
    ['/summary?country=XX', 'country', 'Country is not supported.'],
    ['/summary?level=L9', 'level', 'Level must be one of L1 to L6.'],
    ['/summary?status=DELETED', 'status', 'Status must be ACTIVE, INACTIVE or ALL.'],
    ['/summary?view=euro', 'view', 'View must be local or usd.'],
    ['/by-country?department=', 'department', 'Department must not be empty.'],
    ['/by-level?country=IN&country=US', 'country', 'Country is not supported.'],
  ])('rejects %s', async (path, field, message) => {
    const response = await get(path);

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([{ field, message }]);
  });

  it('rejects parameters it does not know, such as the paging ones', async () => {
    const response = await get('/summary?page=2');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: 'page', message: 'This field is not allowed.' },
    ]);
  });

  it('has no endpoint that groups by something else', async () => {
    const response = await get('/by-city');

    expect(response.status).toBe(404);
  });

  it('never leaks SQL in an error', async () => {
    const response = await get("/summary?country=IN'; DROP TABLE employees;--");

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toMatch(/select|from employees|prisma|stack/i);
    expect(await prisma.employee.count()).toBe(8);
  });
});
