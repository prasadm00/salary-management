import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { unusedServices } from '../../tests/stubs.js';
import { createApp } from '../../app.js';

describe('GET /api/health', () => {
  it('returns 200 and reports the database as up', async () => {
    const app = createApp({ ...unusedServices, checkDatabase: () => Promise.resolve(true) });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('returns 503 and reports the database as down when it cannot be reached', async () => {
    const app = createApp({ ...unusedServices, checkDatabase: () => Promise.resolve(false) });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'down' });
  });

  it('returns 503 when the database check throws', async () => {
    const app = createApp({
      ...unusedServices,
      checkDatabase: () => Promise.reject(new Error('connection refused')),
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'down' });
  });
});
