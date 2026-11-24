import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { aNewEmployeeBody } from '../../tests/builders.js';
import { TEST_NOW } from '../../tests/fixedClock.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app, prisma } = context;

beforeEach(context.reset);
afterAll(context.close);

const post = (body: unknown) =>
  request(app)
    .post('/api/employees')
    .send(body as object);

describe('POST /api/employees', () => {
  it('creates the employee and answers 201 with the full employee and a Location header', async () => {
    const response = await post(aNewEmployeeBody());

    expect(response.status).toBe(201);
    expect(response.headers['location']).toBe('/api/employees/1');
    expect(response.body).toEqual({
      id: 1,
      employeeCode: 'EMP-000001',
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      level: 'L3',
      country: 'IN',
      employmentStatus: 'ACTIVE',
      hireDate: '2021-04-12',
      compensation: { amount: '2000000.00', currency: 'INR', effectiveDate: '2021-04-12' },
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });
  });

  it('saves the employee, the current salary and the starting history row together', async () => {
    await post(aNewEmployeeBody());

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: 1 } });
    const compensation = await prisma.compensation.findUniqueOrThrow({ where: { employeeId: 1 } });
    const history = await prisma.compensationChange.findMany({ where: { employeeId: 1 } });

    expect(employee.email).toBe('asha.rao@acme.example');
    expect(compensation.amount.toFixed(2)).toBe('2000000.00');
    expect(compensation.currency).toBe('INR');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      reason: 'Initial salary',
      oldAmount: null,
      currency: 'INR',
    });
    expect(history[0]?.newAmount.toFixed(2)).toBe('2000000.00');
    expect(history[0]?.changedAt.toISOString()).toBe(TEST_NOW);
  });

  it('sets the currency from the country', async () => {
    const response = await post(aNewEmployeeBody({ country: 'DE', email: 'de@acme.example' }));

    expect(response.body.compensation.currency).toBe('EUR');
  });

  it('stores the email in lower case and trims the text fields', async () => {
    const response = await post(
      aNewEmployeeBody({ email: '  ASHA.Rao@Acme.Example ', fullName: '  Asha Rao ' }),
    );

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('asha.rao@acme.example');
    expect(response.body.fullName).toBe('Asha Rao');
  });

  it('gives sequential employee codes', async () => {
    const first = await post(aNewEmployeeBody());
    const second = await post(aNewEmployeeBody({ email: 'second@acme.example' }));

    expect([first.body.employeeCode, second.body.employeeCode]).toEqual([
      'EMP-000001',
      'EMP-000002',
    ]);
  });

  it.each(['0.10', '999999999999.99', '1'])('keeps the salary %s exact', async (salary) => {
    const response = await post(aNewEmployeeBody({ salary }));

    expect(response.body.compensation.amount).toBe(Number(salary) === 1 ? '1.00' : salary);
  });

  describe('bad input answers 400 and saves nothing', () => {
    it('lists every missing field', async () => {
      const response = await post({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      const fields = response.body.error.details.map((detail: { field: string }) => detail.field);
      expect(fields).toEqual([
        'fullName',
        'email',
        'department',
        'jobTitle',
        'level',
        'country',
        'hireDate',
        'salary',
      ]);
    });

    it.each([
      ['a salary sent as a number', { salary: 2000000 }, 'salary'],
      ['a negative salary', { salary: '-1.00' }, 'salary'],
      ['a salary with three decimals', { salary: '10.001' }, 'salary'],
      ['an invalid email', { email: 'nope' }, 'email'],
      ['an unknown level', { level: 'L9' }, 'level'],
      ['an unknown country', { country: 'XX' }, 'country'],
      ['an impossible date', { hireDate: '2021-02-30' }, 'hireDate'],
      ['a hire date in the future', { hireDate: '2026-11-02' }, 'hireDate'],
    ])('rejects %s', async (_label, override, field) => {
      const response = await post(aNewEmployeeBody(override));

      expect(response.status).toBe(400);
      expect(response.body.error.details).toHaveLength(1);
      expect(response.body.error.details[0].field).toBe(field);
      expect(await prisma.employee.count()).toBe(0);
      expect(await prisma.compensation.count()).toBe(0);
      expect(await prisma.compensationChange.count()).toBe(0);
    });

    it('does not let the client choose the currency or the code', async () => {
      const response = await post(
        aNewEmployeeBody({ currency: 'USD', employeeCode: 'EMP-999999' }),
      );

      expect(response.status).toBe(400);
      const fields = response.body.error.details.map((detail: { field: string }) => detail.field);
      expect(fields.sort()).toEqual(['currency', 'employeeCode']);
      expect(await prisma.employee.count()).toBe(0);
    });

    it('answers 400 when there is no body at all', async () => {
      const response = await request(app).post('/api/employees');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('answers 400 when the body is a list instead of an object', async () => {
      const response = await post([]);

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].field).toBe('body');
    });
  });

  describe('duplicates answer 409', () => {
    it('refuses an email that is already used', async () => {
      await post(aNewEmployeeBody());

      const response = await post(aNewEmployeeBody({ fullName: 'Someone Else' }));

      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'CONFLICT',
        message: 'An employee with this email already exists.',
        details: [{ field: 'email', message: 'This email is already used.' }],
      });
      expect(await prisma.employee.count()).toBe(1);
    });

    it('treats the email as the same whatever its letter case', async () => {
      await post(aNewEmployeeBody());

      const response = await post(aNewEmployeeBody({ email: 'ASHA.RAO@ACME.EXAMPLE' }));

      expect(response.status).toBe(409);
    });

    it('leaves no half-saved rows behind, and the next create still works', async () => {
      await post(aNewEmployeeBody());
      await post(aNewEmployeeBody());

      const next = await post(aNewEmployeeBody({ email: 'other@acme.example' }));

      expect(next.status).toBe(201);
      expect(await prisma.employee.count()).toBe(2);
      expect(await prisma.compensation.count()).toBe(2);
      expect(await prisma.compensationChange.count()).toBe(2);
    });
  });

  it('is not available as DELETE: employees are never removed', async () => {
    await post(aNewEmployeeBody());

    const response = await request(app).delete('/api/employees/1');

    expect(response.status).toBe(404);
    expect(await prisma.employee.count()).toBe(1);
  });
});
