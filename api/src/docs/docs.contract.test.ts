import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext } from '../tests/testApp.js';
import { openApiDocument } from './openapi.js';

/**
 * Calls every documented endpoint on the real app and the test database, and checks that
 * the answer has a documented status and the documented fields. If a route, a status or a field
 * changes without the documentation changing, this test fails.
 */
type Schema = {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
};
type Operation = {
  parameters?: { in: string; name: string; example?: unknown }[];
  requestBody?: { content: { 'application/json': { example: unknown } } };
  responses: Record<string, { content?: { 'application/json': { schema: Schema } } }>;
};

const context = createTestContext();
const paths = openApiDocument.paths as Record<string, Record<string, Operation>>;
const schemas = (openApiDocument.components as { schemas: Record<string, Schema> }).schemas;

// Fields that only appear in some answers (the US dollar view), so they are not always there.
const SOMETIMES_ABSENT = new Set(['ratesAsOf', 'ratesNote', 'details', 'requestId']);

function missingFields(value: unknown, schema: Schema, where = 'body'): string[] {
  const resolved = schema.$ref ? schemas[schema.$ref.replace('#/components/schemas/', '')] : schema;
  if (!resolved) return [`${where}: unknown schema ${schema.$ref}`];

  if (resolved.type === 'array') {
    const first = (value as unknown[])[0];
    return first === undefined || !resolved.items
      ? []
      : missingFields(first, resolved.items, `${where}[0]`);
  }
  if (resolved.properties === undefined) return [];

  const record = value as Record<string, unknown>;
  return Object.entries(resolved.properties).flatMap(([name, child]) => {
    if (SOMETIMES_ABSENT.has(name)) return [];
    if (!(name in record)) return [`${where}.${name} is documented but missing`];
    return record[name] === null ? [] : missingFields(record[name], child, `${where}.${name}`);
  });
}

describe('the documentation matches the real API', () => {
  beforeEach(() => context.reset());
  afterAll(() => context.close());

  it('answers every documented endpoint with a documented status and the documented fields', async () => {
    const problems: string[] = [];
    let employeeId = 0;

    // Documented order matters: the employee has to exist before it can be read or changed.
    const ordered = Object.entries(paths)
      .flatMap(([path, operations]) =>
        Object.entries(operations).map(([method, operation]) => ({ path, method, operation })),
      )
      .sort((a, b) => Number(b.method === 'post') - Number(a.method === 'post'));

    for (const { path, method, operation } of ordered) {
      const url = `/api${path.replace('{id}', String(employeeId || 1))}`;
      const body = operation.requestBody?.content['application/json'].example;
      let call = request(context.app)[method as 'get' | 'post' | 'patch'](url);
      if (body !== undefined) call = call.send(body as object);
      const response = await call;

      const label = `${method.toUpperCase()} ${path}`;
      const documented = operation.responses[String(response.status)];
      if (!documented) {
        problems.push(`${label} answered ${response.status}, which is not documented`);
        continue;
      }
      if (method === 'post') employeeId = (response.body as { id: number }).id;

      const schema = documented.content?.['application/json'].schema;
      if (schema && response.status < 300) {
        problems.push(...missingFields(response.body, schema).map((issue) => `${label}: ${issue}`));
      }
    }

    expect(problems).toEqual([]);
  });

  it('documents the answers an employee with a salary history gives', async () => {
    const created = await request(context.app)
      .post('/api/employees')
      .send(
        (paths['/employees']?.post as Operation).requestBody?.content['application/json']
          .example as object,
      );
    const id = (created.body as { id: number }).id;
    await request(context.app)
      .patch(`/api/employees/${id}/compensation`)
      .send({ amount: '2500000.00', reason: 'Annual review' });

    const history = await request(context.app).get(`/api/employees/${id}/compensation-history`);
    const schema = paths['/employees/{id}/compensation-history']?.get?.responses['200']?.content?.[
      'application/json'
    ].schema as Schema;

    expect(history.body.data).toHaveLength(2);
    expect(missingFields(history.body, schema)).toEqual([]);
  });
});
