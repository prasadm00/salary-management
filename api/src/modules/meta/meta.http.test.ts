import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_EMPLOYEES, seedEmployees } from '../../tests/seedEmployees.js';
import { createTestContext } from '../../tests/testApp.js';

const context = createTestContext();
const { app, prisma } = context;

beforeEach(context.reset);
afterAll(context.close);

const filters = (query = '') => request(app).get(`/api/meta/filters${query}`);

describe('GET /api/meta/filters (5D.5)', () => {
  it('lists only what exists in the data, sorted, with the fixed lists for levels and statuses', async () => {
    await seedEmployees(prisma, SAMPLE_EMPLOYEES);

    const response = await filters();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      countries: [
        { code: 'DE', name: 'Germany', currency: 'EUR' },
        { code: 'IN', name: 'India', currency: 'INR' },
        { code: 'US', name: 'United States', currency: 'USD' },
      ],
      currencies: ['EUR', 'INR', 'USD'],
      departments: ['Engineering', 'Sales', 'Support'],
      levels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'],
      statuses: ['ACTIVE', 'INACTIVE'],
      ratesAsOf: '2026-01-01',
    });
  });

  it('lists each department once, however many people are in it', async () => {
    await seedEmployees(prisma, SAMPLE_EMPLOYEES);

    const response = await filters();

    expect(response.body.departments).toHaveLength(3);
  });

  it('still offers a department that only inactive employees belong to', async () => {
    await seedEmployees(prisma, [
      {
        ...SAMPLE_EMPLOYEES[3]!,
        id: 1,
        department: 'Legal',
        fullName: 'Only Legal',
        email: 'legal@acme.example',
      },
    ]);

    const response = await filters();

    expect(response.body.departments).toEqual(['Legal']);
  });

  it('answers 200 with empty lists when there are no employees yet', async () => {
    const response = await filters();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      countries: [],
      currencies: [],
      departments: [],
      levels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'],
    });
  });

  it('follows the data: a new department appears straight away', async () => {
    await seedEmployees(prisma, [SAMPLE_EMPLOYEES[0]!]);
    expect((await filters()).body.departments).toEqual(['Engineering']);

    await prisma.employee.update({ where: { id: 1 }, data: { department: 'Finance' } });

    expect((await filters()).body.departments).toEqual(['Finance']);
  });

  it('rejects query parameters it does not know', async () => {
    const response = await filters('?country=IN');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: 'country', message: 'This field is not allowed.' },
    ]);
  });
});
