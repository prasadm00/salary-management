import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { aSeedEmployee, seedEmployees } from '../../tests/seedEmployees.js';
import { createTestContext } from '../../tests/testApp.js';

/** Small datasets that prove the figures are exact decimals and are rounded only once, at the end. */
const context = createTestContext();
const { app, prisma } = context;

beforeEach(context.reset);
afterAll(context.close);

const summary = async (query = '') =>
  (await request(app).get(`/api/analytics/summary${query}`)).body;

describe('analytics money is exact (R-04, R-38)', () => {
  it('keeps the largest possible salary exact in every statistic', async () => {
    await seedEmployees(prisma, [aSeedEmployee(1, { amount: '999999999999.99' })]);

    const body = await summary();

    expect(body.groups[0]).toEqual({
      currency: 'USD',
      headcount: 1,
      min: '999999999999.99',
      max: '999999999999.99',
      average: '999999999999.99',
      median: '999999999999.99',
      p25: '999999999999.99',
      p75: '999999999999.99',
    });
  });

  it('adds up many amounts that floating point gets wrong: ten salaries of 0.10 average to 0.10', async () => {
    await seedEmployees(
      prisma,
      Array.from({ length: 10 }, (_, index) => aSeedEmployee(index + 1, { amount: '0.10' })),
    );

    const body = await summary();

    expect(body.groups[0]).toMatchObject({ headcount: 10, average: '0.10', median: '0.10' });
  });

  it('averages to a third of a cent and shows two decimals: 10.00, 10.00 and 10.01 average 10.00', async () => {
    await seedEmployees(prisma, [
      aSeedEmployee(1, { amount: '10.00' }),
      aSeedEmployee(2, { amount: '10.00' }),
      aSeedEmployee(3, { amount: '10.01' }),
    ]);

    const body = await summary();

    expect(body.groups[0].average).toBe('10.00'); // 10.0033...
  });

  it('rounds half away from zero, once: the median of 0.01 and 0.02 is 0.02, not 0.01', async () => {
    await seedEmployees(prisma, [
      aSeedEmployee(1, { amount: '0.01' }),
      aSeedEmployee(2, { amount: '0.02' }),
    ]);

    const body = await summary();

    expect(body.groups[0]).toMatchObject({ median: '0.02', average: '0.02' });
  });

  it('converts to USD in full precision and rounds only the result: 1,234,567.89 INR is 14,814.81 USD', async () => {
    // 1,234,567.89 x 0.012 = 14,814.81468
    await seedEmployees(prisma, [
      aSeedEmployee(1, { country: 'IN', currency: 'INR', amount: '1234567.89' }),
    ]);

    const body = await summary('?view=usd');

    expect(body.groups[0]).toMatchObject({
      currency: 'USD',
      min: '14814.81',
      max: '14814.81',
      average: '14814.81',
      median: '14814.81',
    });
  });

  it('does not round before averaging (R-38): rounding each salary first would give 1.21, not 1.20', async () => {
    // 1.11 EUR x 1.08 = 1.1988 USD and 1.12 EUR x 1.08 = 1.2096 USD
    //   average of the exact values:   (1.1988 + 1.2096) / 2 = 1.2042  -> 1.20
    //   average if rounded first:      (1.20 + 1.21) / 2     = 1.205   -> 1.21 (wrong)
    await seedEmployees(prisma, [
      aSeedEmployee(1, { country: 'DE', currency: 'EUR', amount: '1.11' }),
      aSeedEmployee(2, { country: 'DE', currency: 'EUR', amount: '1.12' }),
    ]);

    const body = await summary('?view=usd');

    expect(body.groups[0]).toMatchObject({
      average: '1.20',
      median: '1.20',
      min: '1.20', // 1.1988 rounded
      max: '1.21', // 1.2096 rounded
    });
  });

  it('puts salaries in different currencies in different groups even when the numbers are identical', async () => {
    await seedEmployees(prisma, [
      aSeedEmployee(1, { country: 'IN', currency: 'INR', amount: '5000.00' }),
      aSeedEmployee(2, { country: 'US', currency: 'USD', amount: '5000.00' }),
    ]);

    const body = await summary();

    expect(body.groups.map((group: { currency: string }) => group.currency)).toEqual([
      'INR',
      'USD',
    ]);
    expect(body.groups.every((group: { headcount: number }) => group.headcount === 1)).toBe(true);
  });

  it('counts a country that shares a currency once per country but once per currency in the summary', async () => {
    await seedEmployees(prisma, [
      aSeedEmployee(1, { country: 'DE', currency: 'EUR', amount: '60000.00' }),
      aSeedEmployee(2, { country: 'FR', currency: 'EUR', amount: '80000.00' }),
    ]);

    const summaryBody = await summary();
    const byCountry = (await request(app).get('/api/analytics/by-country')).body;

    expect(summaryBody.groups).toHaveLength(1);
    expect(summaryBody.groups[0]).toMatchObject({
      currency: 'EUR',
      headcount: 2,
      average: '70000.00',
    });
    expect(byCountry.rows.map((row: { key: string }) => row.key)).toEqual(['DE', 'FR']);
  });
});
