import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { aNewEmployeeBody } from '../../tests/builders.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app, prisma } = context;

beforeEach(context.reset);
afterAll(context.close);

const create = () => request(app).post('/api/employees').send(aNewEmployeeBody());
const setStatus = (id: number | string, body: unknown) =>
  request(app)
    .patch(`/api/employees/${id}/status`)
    .send(body as object);

describe('PATCH /api/employees/:id/status', () => {
  it('deactivates an employee instead of deleting them', async () => {
    await create();

    const response = await setStatus(1, { status: 'INACTIVE' });

    expect(response.status).toBe(200);
    expect(response.body.employmentStatus).toBe('INACTIVE');
    expect(await prisma.employee.count()).toBe(1);
  });

  it('reactivates an employee', async () => {
    await create();
    await setStatus(1, { status: 'INACTIVE' });

    const response = await setStatus(1, { status: 'ACTIVE' });

    expect(response.body.employmentStatus).toBe('ACTIVE');
  });

  it('leaves the salary and the history untouched', async () => {
    await create();

    const response = await setStatus(1, { status: 'INACTIVE' });

    expect(response.body.compensation.amount).toBe('2000000.00');
    expect(await prisma.compensationChange.count()).toBe(1);
  });

  it('accepts the status the employee already has and changes nothing', async () => {
    const created = await create();

    const response = await setStatus(1, { status: 'ACTIVE' });

    expect(response.status).toBe(200);
    expect(response.body.updatedAt).toBe(created.body.updatedAt);
  });

  it('answers 404 for an unknown employee', async () => {
    const response = await setStatus(999, { status: 'INACTIVE' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it.each([{ status: 'DELETED' }, { status: 'active' }, {}, { status: 'ACTIVE', reason: 'x' }])(
    'answers 400 for the body %j',
    async (body) => {
      await create();

      const response = await setStatus(1, body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('answers 400 for an invalid id', async () => {
    const response = await setStatus('abc', { status: 'INACTIVE' });

    expect(response.status).toBe(400);
  });
});
