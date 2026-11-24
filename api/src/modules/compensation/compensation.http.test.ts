import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aNewEmployeeBody } from '../../tests/builders.js';
import { movableClock } from '../../tests/fixedClock.js';
import { createTestContext } from '../../tests/testApp.js';
import { PrismaEmployeeRepository } from '../employees/prismaEmployeeRepository.js';

const clock = movableClock();
const context = createTestContext(clock);
const { app, prisma } = context;

beforeEach(async () => {
  clock.set('2026-11-01T09:00:00.000Z');
  await context.reset();
  await request(app).post('/api/employees').send(aNewEmployeeBody());
});
afterEach(() => vi.restoreAllMocks());
afterAll(context.close);

const changeSalary = (body: unknown, id: number | string = 1) =>
  request(app)
    .patch(`/api/employees/${id}/compensation`)
    .send(body as object);
const history = (query = '', id: number | string = 1) =>
  request(app).get(`/api/employees/${id}/compensation-history${query}`);

async function currentAmount(): Promise<string> {
  const row = await prisma.compensation.findUniqueOrThrow({ where: { employeeId: 1 } });
  return row.amount.toFixed(2);
}

describe('PATCH /api/employees/:id/compensation', () => {
  it('changes the salary and answers 200 with the updated employee', async () => {
    clock.set('2027-04-01T08:30:00.000Z');

    const response = await changeSalary({ amount: '2400000.00', reason: 'Annual review 2027' });

    expect(response.status).toBe(200);
    expect(response.body.compensation).toEqual({
      amount: '2400000.00',
      currency: 'INR',
      effectiveDate: '2027-04-01',
    });
    expect(await currentAmount()).toBe('2400000.00');
  });

  it('writes a history row with old and new amount, currency, reason and time', async () => {
    clock.set('2027-04-01T08:30:00.000Z');

    await changeSalary({ amount: '2400000.00', reason: '  Annual review 2027 ' });

    const rows = await prisma.compensationChange.findMany({ orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[1]?.oldAmount?.toFixed(2)).toBe('2000000.00');
    expect(rows[1]?.newAmount.toFixed(2)).toBe('2400000.00');
    expect(rows[1]).toMatchObject({ currency: 'INR', reason: 'Annual review 2027' });
    expect(rows[1]?.changedAt.toISOString()).toBe('2027-04-01T08:30:00.000Z');
  });

  it('keeps the exact cents', async () => {
    await changeSalary({ amount: '2000000.10', reason: 'Small correction' });

    expect(await currentAmount()).toBe('2000000.10');
  });

  it('allows a decrease', async () => {
    const response = await changeSalary({ amount: '1500000.00', reason: 'Role change' });

    expect(response.status).toBe(200);
  });

  describe('R-07: the amount must change', () => {
    it('answers 422 and saves nothing, even when written as 2000000 without decimals', async () => {
      const response = await changeSalary({ amount: '2000000', reason: 'No real change' });

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({
        code: 'BUSINESS_RULE_VIOLATION',
        details: [
          { field: 'amount', message: 'The new amount is the same as the current amount.' },
        ],
      });
      expect(await prisma.compensationChange.count()).toBe(1);
      expect(await currentAmount()).toBe('2000000.00');
    });
  });

  describe('bad input answers 400 and saves nothing', () => {
    it.each([
      ['no reason', { amount: '2400000.00' }, 'reason', 'A reason is required.'],
      [
        'a blank reason',
        { amount: '2400000.00', reason: '   ' },
        'reason',
        'A reason is required.',
      ],
      [
        'a too short reason',
        { amount: '2400000.00', reason: 'ab' },
        'reason',
        'Reason must be at least 3 characters.',
      ],
      ['no amount', { reason: 'Annual review' }, 'amount', 'Amount is required.'],
      [
        'an amount sent as a number',
        { amount: 2400000, reason: 'Annual review' },
        'amount',
        'Amount must be given as text, for example "2400000.00".',
      ],
      [
        'a negative amount',
        { amount: '-5', reason: 'Annual review' },
        'amount',
        'Amount must be greater than zero.',
      ],
      [
        'a zero amount',
        { amount: '0.00', reason: 'Annual review' },
        'amount',
        'Amount must be greater than zero.',
      ],
      [
        'three decimals',
        { amount: '10.001', reason: 'Annual review' },
        'amount',
        'Amount must have at most two decimal places.',
      ],
    ])('rejects %s', async (_label, body, field, message) => {
      const response = await changeSalary(body);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([{ field, message }]);
      expect(await prisma.compensationChange.count()).toBe(1);
      expect(await currentAmount()).toBe('2000000.00');
    });

    it('R-09: does not let the currency be changed, or any other field be sent', async () => {
      const response = await changeSalary({
        amount: '2400000.00',
        reason: 'Annual review',
        currency: 'USD',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual([
        { field: 'currency', message: 'This field is not allowed.' },
      ]);
      expect(await currentAmount()).toBe('2000000.00');
    });

    it('answers 400 when there is no body', async () => {
      const response = await request(app).patch('/api/employees/1/compensation');

      expect(response.status).toBe(400);
    });
  });

  it('answers 404 for an unknown employee', async () => {
    const response = await changeSalary({ amount: '2400000.00', reason: 'Annual review' }, 999);

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Employee not found.');
  });

  it('answers 400 for an invalid id', async () => {
    const response = await changeSalary({ amount: '2400000.00', reason: 'Annual review' }, 'abc');

    expect(response.status).toBe(400);
  });

  describe('R-10: the salary and its history are saved together or not at all', () => {
    it('rolls back the new salary when the history row cannot be written', async () => {
      vi.spyOn(PrismaEmployeeRepository.prototype, 'insertChange').mockRejectedValue(
        new Error('disk full'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const response = await changeSalary({ amount: '2400000.00', reason: 'Annual review' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(response.body)).not.toContain('disk full');
      expect(await currentAmount()).toBe('2000000.00');
      expect(await prisma.compensationChange.count()).toBe(1);
    });

    it('works again once the fault is gone', async () => {
      vi.spyOn(PrismaEmployeeRepository.prototype, 'insertChange').mockRejectedValueOnce(
        new Error('temporary fault'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await changeSalary({ amount: '2400000.00', reason: 'Annual review' });

      const retry = await changeSalary({ amount: '2400000.00', reason: 'Annual review' });

      expect(retry.status).toBe(200);
      expect(await currentAmount()).toBe('2400000.00');
      expect(await prisma.compensationChange.count()).toBe(2);
    });

    it('rolls back a new employee when the starting history row cannot be written', async () => {
      vi.spyOn(PrismaEmployeeRepository.prototype, 'insertChange').mockRejectedValue(
        new Error('disk full'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const response = await request(app)
        .post('/api/employees')
        .send(aNewEmployeeBody({ email: 'second@acme.example' }));

      expect(response.status).toBe(500);
      expect(await prisma.employee.count()).toBe(1);
      expect(await prisma.compensation.count()).toBe(1);
    });
  });

  it('serialises two changes made at the same moment, so the history has no gaps', async () => {
    const responses = await Promise.all([
      changeSalary({ amount: '2100000.00', reason: 'Change A' }),
      changeSalary({ amount: '2200000.00', reason: 'Change B' }),
      changeSalary({ amount: '2300000.00', reason: 'Change C' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    const rows = await prisma.compensationChange.findMany({ orderBy: { id: 'asc' } });
    // Each row starts from where the previous one ended. Without the row lock, rows would share an old amount.
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]?.oldAmount?.toFixed(2)).toBe(rows[index - 1]?.newAmount.toFixed(2));
    }
    expect(await currentAmount()).toBe(rows.at(-1)?.newAmount.toFixed(2));
  });
});

describe('GET /api/employees/:id/compensation-history', () => {
  it('starts with the first salary, which has no old amount', async () => {
    const response = await history();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    expect(response.body.data).toEqual([
      {
        id: 1,
        employeeId: 1,
        oldAmount: null,
        newAmount: '2000000.00',
        currency: 'INR',
        reason: 'Initial salary',
        changedAt: '2026-11-01T09:00:00.000Z',
      },
    ]);
  });

  it('lists the newest change first', async () => {
    clock.set('2026-12-01T09:00:00.000Z');
    await changeSalary({ amount: '2100000.00', reason: 'First raise' });
    clock.set('2027-01-01T09:00:00.000Z');
    await changeSalary({ amount: '2200000.00', reason: 'Second raise' });

    const response = await history();

    expect(response.body.data.map((row: { reason: string }) => row.reason)).toEqual([
      'Second raise',
      'First raise',
      'Initial salary',
    ]);
  });

  it('puts the later row first even when two changes have exactly the same time', async () => {
    await changeSalary({ amount: '2100000.00', reason: 'Raise at the same moment' });

    const response = await history();

    expect(response.body.data.map((row: { reason: string }) => row.reason)).toEqual([
      'Raise at the same moment',
      'Initial salary',
    ]);
  });

  it('pages through the entries without repeating or skipping any', async () => {
    for (const amount of ['2100000.00', '2200000.00', '2300000.00', '2400000.00']) {
      await changeSalary({ amount, reason: `Raise to ${amount}` });
    }

    const first = await history('?page=1&pageSize=2');
    const second = await history('?page=2&pageSize=2');
    const third = await history('?page=3&pageSize=2');

    expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 5 });
    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map(
      (row: { id: number }) => row.id,
    );
    expect(ids).toEqual([5, 4, 3, 2, 1]);
    expect(third.body.data).toHaveLength(1);
  });

  it('returns an empty list with the right total for a page past the end', async () => {
    const response = await history('?page=50');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], page: 50, pageSize: 25, total: 1 });
  });

  it('only shows the history of the employee asked for', async () => {
    await request(app)
      .post('/api/employees')
      .send(aNewEmployeeBody({ email: 'other@acme.example' }));
    await changeSalary({ amount: '2100000.00', reason: 'Only for employee one' }, 2);

    const response = await history('', 1);

    expect(response.body.total).toBe(1);
  });

  it.each([
    ['?pageSize=101', 'pageSize', 'Page size must be a whole number from 1 to 100.'],
    ['?pageSize=0', 'pageSize', 'Page size must be a whole number from 1 to 100.'],
    ['?pageSize=abc', 'pageSize', 'Page size must be a whole number from 1 to 100.'],
    ['?page=0', 'page', 'Page must be a whole number of 1 or more.'],
    ['?page=-1', 'page', 'Page must be a whole number of 1 or more.'],
    ['?page=1.5', 'page', 'Page must be a whole number of 1 or more.'],
    ['?page=1&page=2', 'page', 'Page must be a whole number of 1 or more.'],
    ['?pagesize=5', 'pagesize', 'This field is not allowed.'],
  ])('answers 400 for %s', async (query, field, message) => {
    const response = await history(query);

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([{ field, message }]);
  });

  it('answers 404 for an unknown employee', async () => {
    const response = await history('', 999);

    expect(response.status).toBe(404);
  });

  it('answers 400 for an invalid id', async () => {
    const response = await history('', 'abc');

    expect(response.status).toBe(400);
  });

  it('cannot be changed through the API: there is no way to edit or delete history', async () => {
    const put = await request(app).put('/api/employees/1/compensation-history').send({});
    const del = await request(app).delete('/api/employees/1/compensation-history');
    const post = await request(app).post('/api/employees/1/compensation-history').send({});

    expect([put.status, del.status, post.status]).toEqual([404, 404, 404]);
    expect(await prisma.compensationChange.count()).toBe(1);
  });
});
