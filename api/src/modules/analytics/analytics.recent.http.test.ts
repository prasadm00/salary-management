import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { aNewEmployeeBody } from '../../tests/builders.js';
import { movableClock } from '../../tests/fixedClock.js';
import { createTestContext } from '../../tests/testApp.js';

const clock = movableClock();
const context = createTestContext(clock);
const { app } = context;

beforeEach(async () => {
  clock.set('2026-11-01T09:00:00.000Z');
  await context.reset();
});
afterAll(context.close);

const recent = (query = '') => request(app).get(`/api/analytics/recent-changes${query}`);
const create = (overrides: Record<string, unknown> = {}) =>
  request(app).post('/api/employees').send(aNewEmployeeBody(overrides));
const raise = (id: number, amount: string, reason: string) =>
  request(app).patch(`/api/employees/${id}/compensation`).send({ amount, reason });

describe('GET /api/analytics/recent-changes (5E.6, US-14)', () => {
  it('lists the latest salary changes, newest first, with who they are about', async () => {
    await create();
    await create({
      email: 'liam@acme.example',
      fullName: 'Liam Carter',
      country: 'US',
      salary: '95000.00',
    });
    clock.set('2026-12-01T09:00:00.000Z');
    await raise(1, '2400000.00', 'Annual review');
    clock.set('2027-01-15T10:30:00.000Z');
    await raise(2, '99000.50', 'Promotion');

    const response = await recent();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: 4,
          employee: { id: 2, employeeCode: 'EMP-000002', fullName: 'Liam Carter' },
          oldAmount: '95000.00',
          newAmount: '99000.50',
          currency: 'USD',
          reason: 'Promotion',
          changedAt: '2027-01-15T10:30:00.000Z',
        },
        {
          id: 3,
          employee: { id: 1, employeeCode: 'EMP-000001', fullName: 'Asha Rao' },
          oldAmount: '2000000.00',
          newAmount: '2400000.00',
          currency: 'INR',
          reason: 'Annual review',
          changedAt: '2026-12-01T09:00:00.000Z',
        },
      ],
    });
  });

  it('leaves out the starting salaries, because they are not changes', async () => {
    await create();
    await create({ email: 'second@acme.example' });

    const response = await recent();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
  });

  it('returns an empty list when there are no employees at all', async () => {
    const response = await recent();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [] });
  });

  it('shows 10 changes by default and at most the limit asked for', async () => {
    await create();
    for (let step = 1; step <= 12; step += 1) {
      clock.set(`2026-12-${String(step).padStart(2, '0')}T09:00:00.000Z`);
      await raise(1, `${2000000 + step}.00`, `Raise ${step}`);
    }

    const byDefault = await recent();
    const three = await recent('?limit=3');

    expect(byDefault.body.data).toHaveLength(10);
    expect(byDefault.body.data[0].reason).toBe('Raise 12');
    expect(three.body.data.map((change: { reason: string }) => change.reason)).toEqual([
      'Raise 12',
      'Raise 11',
      'Raise 10',
    ]);
  });

  it('puts the later change first when two share the same moment', async () => {
    await create();
    await raise(1, '2100000.00', 'First at noon');
    await raise(1, '2200000.00', 'Second at noon');

    const response = await recent();

    expect(response.body.data.map((change: { reason: string }) => change.reason)).toEqual([
      'Second at noon',
      'First at noon',
    ]);
  });

  it('sends amounts as text with two decimals', async () => {
    await create();
    await raise(1, '2100000.10', 'Cents');

    const { body } = await recent();

    expect(body.data[0].oldAmount).toBe('2000000.00');
    expect(body.data[0].newAmount).toBe('2100000.10');
  });

  it.each(['0', '26', '-1', 'abc', ''])('rejects the limit "%s"', async (limit) => {
    const response = await recent(`?limit=${limit}`);

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: 'limit', message: 'Limit must be a whole number from 1 to 25.' },
    ]);
  });

  it('does not take the analytics filters', async () => {
    const response = await recent('?country=IN');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: 'country', message: 'This field is not allowed.' },
    ]);
  });
});
