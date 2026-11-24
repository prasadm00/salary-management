import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_EMPLOYEES, aSeedEmployee, seedEmployees } from '../../tests/seedEmployees.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app, prisma } = context;

beforeEach(context.reset);
afterAll(context.close);

const distribution = (query: string) => request(app).get(`/api/analytics/distribution${query}`);

interface Bucket {
  from: string;
  to: string;
  count: number;
}

describe('GET /api/analytics/distribution (5E.4, US-12)', () => {
  describe('buckets of equal width, in one currency', () => {
    it('INR: 1,200,000 to 2,400,000 in 5 buckets of 240,000', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?currency=INR&buckets=5');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        view: 'local',
        currency: 'INR',
        headcount: 3,
        min: '1200000.00',
        max: '2400000.00',
        buckets: [
          { from: '1200000.00', to: '1440000.00', count: 1 }, // 1,200,000
          { from: '1440000.00', to: '1680000.00', count: 0 },
          { from: '1680000.00', to: '1920000.00', count: 1 }, // 1,800,000
          { from: '1920000.00', to: '2160000.00', count: 0 },
          { from: '2160000.00', to: '2400000.00', count: 1 }, // 2,400,000 is the maximum, so it is in the last bucket
        ],
      });
    });

    it('USD: 50,000 to 95,000 in 5 buckets of 9,000', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?currency=USD&buckets=5');

      expect(response.body.buckets).toEqual([
        { from: '50000.00', to: '59000.00', count: 1 }, // 50,000
        { from: '59000.00', to: '68000.00', count: 1 }, // 60,000
        { from: '68000.00', to: '77000.00', count: 0 },
        { from: '77000.00', to: '86000.00', count: 0 },
        { from: '86000.00', to: '95000.00', count: 1 }, // 95,000
      ]);
    });

    it('uses 10 buckets by default', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?currency=INR');

      expect(response.body.buckets).toHaveLength(10);
      expect(response.body.buckets.map((bucket: Bucket) => bucket.count)).toEqual([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 1,
      ]);
    });

    it.each([5, 12, 30])('returns exactly %i buckets when asked', async (buckets) => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution(`?currency=INR&buckets=${buckets}`);

      expect(response.body.buckets).toHaveLength(buckets);
    });
  });

  describe('every person is in exactly one bucket', () => {
    // Range 100.01 in 5 buckets does not divide evenly, so the width is rounded up to 20.01.
    const amounts = ['10.00', '30.00', '30.01', '50.01', '50.02', '110.01'];

    beforeEach(async () => {
      await seedEmployees(
        prisma,
        amounts.map((amount, index) => aSeedEmployee(index + 1, { amount })),
      );
    });

    it('rounds the bucket width up to a whole cent, so edges are exact amounts', async () => {
      const response = await distribution('?currency=USD&buckets=5');

      expect(response.body.buckets).toEqual([
        { from: '10.00', to: '30.01', count: 2 }, // 10.00 and 30.00
        { from: '30.01', to: '50.02', count: 2 }, // 30.01 is on the edge, so it starts this bucket
        { from: '50.02', to: '70.03', count: 1 }, // 50.02 is on the edge, so it starts this bucket
        { from: '70.03', to: '90.04', count: 0 },
        { from: '90.04', to: '110.05', count: 1 }, // 110.01, the maximum
      ]);
    });

    it('the counts add up to the headcount', async () => {
      const response = await distribution('?currency=USD&buckets=5');

      const total = response.body.buckets.reduce(
        (sum: number, bucket: Bucket) => sum + bucket.count,
        0,
      );
      expect(total).toBe(response.body.headcount);
      expect(response.body.headcount).toBe(6);
    });

    it('buckets are equal in width and touch each other, with no gaps or overlaps', async () => {
      const { body } = await distribution('?currency=USD&buckets=5');

      const widths = body.buckets.map((bucket: Bucket) =>
        (Number(bucket.to) - Number(bucket.from)).toFixed(2),
      );
      expect(new Set(widths)).toEqual(new Set(['20.01']));
      body.buckets.slice(1).forEach((bucket: Bucket, index: number) => {
        expect(bucket.from).toBe(body.buckets[index].to);
      });
    });

    it('the first bucket starts at the minimum and the last bucket reaches at least the maximum', async () => {
      const { body } = await distribution('?currency=USD&buckets=5');

      expect(body.buckets[0].from).toBe(body.min);
      expect(Number(body.buckets.at(-1).to)).toBeGreaterThanOrEqual(Number(body.max));
    });
  });

  describe('unusual data', () => {
    it('puts everyone in one bucket when all salaries are the same', async () => {
      await seedEmployees(
        prisma,
        [1, 2, 3].map((id) => aSeedEmployee(id, { amount: '100.00' })),
      );

      const response = await distribution('?currency=USD&buckets=10');

      expect(response.body).toMatchObject({
        headcount: 3,
        min: '100.00',
        max: '100.00',
        buckets: [{ from: '100.00', to: '100.00', count: 3 }],
      });
    });

    it('works for one person', async () => {
      await seedEmployees(prisma, [aSeedEmployee(1, { amount: '77.77' })]);

      const response = await distribution('?currency=USD');

      expect(response.body.buckets).toEqual([{ from: '77.77', to: '77.77', count: 1 }]);
    });

    it('returns no buckets, and null limits, when nobody matches', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?currency=JPY');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        view: 'local',
        currency: 'JPY',
        headcount: 0,
        min: null,
        max: null,
        buckets: [],
      });
    });

    it('keeps very large salaries exact', async () => {
      await seedEmployees(prisma, [
        aSeedEmployee(1, { amount: '999999999999.99' }),
        aSeedEmployee(2, { amount: '999999999999.97' }),
      ]);

      const response = await distribution('?currency=USD&buckets=5');

      expect(response.body.min).toBe('999999999999.97');
      expect(response.body.max).toBe('999999999999.99');
      expect(response.body.buckets[0].from).toBe('999999999999.97');
    });
  });

  describe('filters', () => {
    it('counts only active people by default and includes inactive ones with status=ALL', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const active = await distribution('?currency=USD');
      const all = await distribution('?currency=USD&status=ALL');

      expect(active.body).toMatchObject({ headcount: 3, min: '50000.00' });
      expect(all.body).toMatchObject({ headcount: 4, min: '42000.00' });
    });

    it('applies country, department and level', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?currency=INR&department=Engineering&level=L3');

      expect(response.body).toMatchObject({ headcount: 1, min: '2400000.00', max: '2400000.00' });
    });
  });

  describe('the USD view (5E.5)', () => {
    it('buckets every salary converted to dollars, and labels the result', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?view=usd&buckets=5');

      // 14,400  21,600  28,800  50,000  60,000  95,000  97,200  ->  width 16,560
      expect(response.body).toEqual({
        view: 'usd',
        ratesAsOf: '2026-01-01',
        ratesNote: 'Fixed, illustrative exchange rates. Not live market data.',
        currency: 'USD',
        headcount: 7,
        min: '14400.00',
        max: '97200.00',
        buckets: [
          { from: '14400.00', to: '30960.00', count: 3 },
          { from: '30960.00', to: '47520.00', count: 0 },
          { from: '47520.00', to: '64080.00', count: 2 },
          { from: '64080.00', to: '80640.00', count: 0 },
          { from: '80640.00', to: '97200.00', count: 2 },
        ],
      });
    });

    it('needs no currency, and ignores one that is sent', async () => {
      await seedEmployees(prisma, SAMPLE_EMPLOYEES);

      const response = await distribution('?view=usd&currency=INR');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ currency: 'USD', headcount: 7 });
    });
  });

  describe('input checking', () => {
    it('needs a currency in the local view, because rupees and dollars cannot share a histogram', async () => {
      const response = await distribution('');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'currency', message: 'Currency is required in the local view.' },
      ]);
    });

    it.each(['4', '31', '0', 'abc', '', '7.5'])('rejects %s buckets', async (buckets) => {
      const response = await distribution(`?currency=INR&buckets=${buckets}`);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'buckets', message: 'Buckets must be a whole number from 5 to 30.' },
      ]);
    });

    it('rejects an unknown currency and unknown parameters', async () => {
      const currency = await distribution('?currency=ZZZ');
      const unknown = await distribution('?currency=INR&bins=5');

      expect(currency.body.error.details).toEqual([
        { field: 'currency', message: 'Currency is not supported.' },
      ]);
      expect(unknown.body.error.details).toEqual([
        { field: 'bins', message: 'This field is not allowed.' },
      ]);
    });
  });
});
