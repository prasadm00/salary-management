import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_EMPLOYEES, aSeedEmployee, seedEmployees } from '../../tests/seedEmployees.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app, prisma } = context;

beforeEach(async () => {
  await context.reset();
  await seedEmployees(prisma, SAMPLE_EMPLOYEES);
});
afterAll(context.close);

const extremes = (query: string) => request(app).get(`/api/analytics/extremes${query}`);
const idsOf = (people: { id: number }[]) => people.map((person) => person.id);

describe('GET /api/analytics/extremes (5E.6, US-14)', () => {
  it('lists the highest paid first and the lowest paid first, within one currency', async () => {
    const response = await extremes('?currency=USD');

    expect(response.status).toBe(200);
    // Active USD salaries: Liam 95,000  SamxLee 60,000  Sam_Lee 50,000
    expect(idsOf(response.body.top)).toEqual([3, 8, 7]);
    expect(idsOf(response.body.bottom)).toEqual([7, 8, 3]);
  });

  it('returns what the HR manager needs to recognise each person', async () => {
    const response = await extremes('?currency=USD&limit=1');

    expect(response.body).toEqual({
      view: 'local',
      currency: 'USD',
      top: [
        {
          id: 3,
          employeeCode: 'EMP-000003',
          fullName: 'Liam Carter',
          department: 'Sales',
          level: 'L4',
          country: 'US',
          amount: '95000.00',
        },
      ],
      bottom: [
        {
          id: 7,
          employeeCode: 'EMP-000007',
          fullName: 'Sam_Lee',
          department: 'Support',
          level: 'L2',
          country: 'US',
          amount: '50000.00',
        },
      ],
    });
  });

  it('never mixes currencies: INR has its own lists', async () => {
    const response = await extremes('?currency=INR');

    expect(idsOf(response.body.top)).toEqual([1, 6, 2]);
    expect(idsOf(response.body.bottom)).toEqual([2, 6, 1]);
  });

  it('limits how many people are listed', async () => {
    const response = await extremes('?currency=USD&limit=2');

    expect(idsOf(response.body.top)).toEqual([3, 8]);
    expect(idsOf(response.body.bottom)).toEqual([7, 8]);
  });

  it('lists everyone, once, when the limit is larger than the group', async () => {
    const response = await extremes('?currency=INR&limit=25');

    expect(response.body.top).toHaveLength(3);
    expect(response.body.bottom).toHaveLength(3);
  });

  it('breaks ties by id, in both lists', async () => {
    await context.reset();
    await seedEmployees(prisma, [
      aSeedEmployee(1, { amount: '100.00' }),
      aSeedEmployee(2, { amount: '100.00' }),
      aSeedEmployee(3, { amount: '200.00' }),
    ]);

    const response = await extremes('?currency=USD');

    expect(idsOf(response.body.top)).toEqual([3, 1, 2]);
    expect(idsOf(response.body.bottom)).toEqual([1, 2, 3]);
  });

  it('includes inactive people only when asked', async () => {
    const active = await extremes('?currency=USD');
    const all = await extremes('?currency=USD&status=ALL');

    expect(idsOf(active.body.bottom)).toEqual([7, 8, 3]);
    expect(idsOf(all.body.bottom)).toEqual([4, 7, 8, 3]);
  });

  it('applies the shared filters', async () => {
    const response = await extremes('?currency=INR&department=Sales');

    expect(idsOf(response.body.top)).toEqual([6]);
    expect(idsOf(response.body.bottom)).toEqual([6]);
  });

  it('returns empty lists when nobody matches', async () => {
    const response = await extremes('?currency=JPY');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ view: 'local', currency: 'JPY', top: [], bottom: [] });
  });

  describe('the USD view (5E.5)', () => {
    it('ranks everyone by their salary in dollars and shows the converted amount', async () => {
      const response = await extremes('?view=usd&limit=3');

      expect(
        response.body.top.map((person: { id: number; amount: string }) => [
          person.id,
          person.amount,
        ]),
      ).toEqual([
        [5, '97200.00'], // Hans, 90,000 EUR
        [3, '95000.00'],
        [8, '60000.00'],
      ]);
      expect(
        response.body.bottom.map((person: { id: number; amount: string }) => [
          person.id,
          person.amount,
        ]),
      ).toEqual([
        [2, '14400.00'], // Priya, 1,200,000 INR
        [6, '21600.00'],
        [1, '28800.00'],
      ]);
    });

    it('is labelled with the date of the rates and reports USD', async () => {
      const response = await extremes('?view=usd');

      expect(response.body).toMatchObject({
        view: 'usd',
        currency: 'USD',
        ratesAsOf: '2026-01-01',
        ratesNote: 'Fixed, illustrative exchange rates. Not live market data.',
      });
    });

    it('needs no currency', async () => {
      const response = await extremes('?view=usd');

      expect(response.status).toBe(200);
    });
  });

  describe('input checking', () => {
    it('needs a currency in the local view', async () => {
      const response = await extremes('');

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'currency', message: 'Currency is required in the local view.' },
      ]);
    });

    it.each(['0', '26', '-1', 'abc', ''])('rejects the limit "%s"', async (limit) => {
      const response = await extremes(`?currency=USD&limit=${limit}`);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'limit', message: 'Limit must be a whole number from 1 to 25.' },
      ]);
    });
  });
});
