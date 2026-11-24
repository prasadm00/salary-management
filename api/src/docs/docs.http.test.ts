import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { unusedServices } from '../tests/stubs.js';
import { openApiDocument } from './openapi.js';

const app = createApp({ ...unusedServices, checkDatabase: () => Promise.resolve(true) });

interface PostmanRequest {
  url: { raw: string; variable: { key: string; value: string }[] };
  body: { raw: string };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function documentedOperations(): { method: string; path: string; summary: string }[] {
  const paths = openApiDocument.paths as Record<string, Record<string, { summary: string }>>;
  return Object.entries(paths).flatMap(([path, operations]) =>
    HTTP_METHODS.filter((method) => operations[method]).map((method) => ({
      method,
      path,
      summary: operations[method]?.summary ?? '',
    })),
  );
}

describe('API documentation', () => {
  it('shows the Swagger page', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.type).toContain('html');
    expect(response.text).toContain('swagger-ui');
  });

  it('serves the OpenAPI description, so tools can import it', async () => {
    const response = await request(app).get('/api/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(Object.keys(response.body.paths)).toContain('/employees/{id}/compensation');
  });

  it('describes every endpoint with a summary', () => {
    for (const operation of documentedOperations()) {
      expect(operation.summary, `${operation.method} ${operation.path}`).not.toBe('');
    }
  });
});

describe('Postman collection download', () => {
  it('is a file download in the Postman format', async () => {
    const response = await request(app).get('/api/docs/postman-collection.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('.postman_collection.json');
    expect(JSON.parse(response.text).info.schema).toContain('collection/v2.1.0');
  });

  it('has one request for each documented endpoint, grouped in folders', async () => {
    const response = await request(app).get('/api/docs/postman-collection.json');
    const collection = JSON.parse(response.text) as { item: { name: string; item: unknown[] }[] };

    const requestCount = collection.item.reduce((total, folder) => total + folder.item.length, 0);
    expect(requestCount).toBe(documentedOperations().length);
    expect(collection.item.map((folder) => folder.name)).toContain('Employees');
  });

  it('points at the server it was downloaded from, in one variable', async () => {
    const response = await request(app).get('/api/docs/postman-collection.json');
    const collection = JSON.parse(response.text) as { variable: { key: string; value: string }[] };

    expect(collection.variable).toEqual([
      {
        key: 'baseUrl',
        value: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/api$/) as string,
      },
    ]);
  });

  it('uses https when the host runs behind a proxy that says so', async () => {
    const response = await request(app)
      .get('/api/docs/postman-collection.json')
      .set('Host', 'salary.example.com')
      .set('X-Forwarded-Proto', 'https');

    expect(JSON.parse(response.text).variable[0].value).toBe('https://salary.example.com/api');
  });

  it('fills in example bodies and path values, so requests work as soon as they are imported', async () => {
    const response = await request(app).get('/api/docs/postman-collection.json');
    const collection = JSON.parse(response.text) as {
      item: { item: { name: string; request: PostmanRequest }[] }[];
    };
    const requests = collection.item.flatMap((folder) => folder.item);
    const changeSalary = requests.find((item) => item.name === 'Change the salary');

    expect(changeSalary?.request.url.raw).toBe('{{baseUrl}}/employees/:id/compensation');
    expect(changeSalary?.request.url.variable[0]).toMatchObject({ key: 'id', value: '1' });
    expect(JSON.parse(changeSalary?.request.body.raw as string)).toEqual({
      amount: '2500000.00',
      reason: 'Annual review',
    });
  });
});
