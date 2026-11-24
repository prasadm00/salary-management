import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { aNewEmployeeBody } from '../../tests/builders.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app } = context;

beforeEach(context.reset);
afterAll(context.close);

describe('GET /api/employees/:id', () => {
  it('returns the employee with their current salary', async () => {
    const created = await request(app).post('/api/employees').send(aNewEmployeeBody());

    const response = await request(app).get(`/api/employees/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created.body);
    expect(response.body.compensation).toEqual({
      amount: '2000000.00',
      currency: 'INR',
      effectiveDate: '2021-04-12',
    });
  });

  it('finds an employee by the id in the URL when there are several', async () => {
    await request(app).post('/api/employees').send(aNewEmployeeBody());
    await request(app)
      .post('/api/employees')
      .send(
        aNewEmployeeBody({
          email: 'liam.carter@acme.example',
          fullName: 'Liam Carter',
          country: 'US',
        }),
      );

    const response = await request(app).get('/api/employees/2');

    expect(response.body).toMatchObject({
      id: 2,
      fullName: 'Liam Carter',
      employeeCode: 'EMP-000002',
      compensation: { currency: 'USD' },
    });
  });

  it('still returns an inactive employee, because nobody is ever deleted', async () => {
    await request(app).post('/api/employees').send(aNewEmployeeBody());
    await request(app).patch('/api/employees/1/status').send({ status: 'INACTIVE' });

    const response = await request(app).get('/api/employees/1');

    expect(response.status).toBe(200);
    expect(response.body.employmentStatus).toBe('INACTIVE');
  });

  it('answers 404 NOT_FOUND with a clear message for an unknown id', async () => {
    const response = await request(app).get('/api/employees/12345');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Employee not found.',
      requestId: expect.any(String),
    });
  });

  it.each(['abc', '0', '-1', '1.5', '1e3', '2147483648', '99999999999999999999'])(
    'answers 400 for the invalid id "%s", never a 500',
    async (id) => {
      const response = await request(app).get(`/api/employees/${id}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual([
        { field: 'id', message: 'Employee id must be a positive whole number.' },
      ]);
    },
  );

  it('does not leak SQL or stack traces in any error', async () => {
    const response = await request(app).get("/api/employees/1'; DROP TABLE employees;--");

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toMatch(/select|drop|prisma|stack/i);
  });
});
