/** Turns the OpenAPI document into a Postman collection (v2.1) that can be imported and used right away. */

interface Parameter {
  name: string;
  in: 'query' | 'path';
  description?: string;
  example?: unknown;
  schema?: { default?: unknown; enum?: unknown[] };
}

interface Operation {
  tags?: string[];
  summary: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: { content: { 'application/json': { example?: unknown } } };
}

interface ApiDescription {
  info: { title: string; description: string };
  paths: Record<string, Record<string, Operation>>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function sampleValue(parameter: Parameter): string {
  const value = parameter.example ?? parameter.schema?.default ?? parameter.schema?.enum?.[0];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function toRequestItem(path: string, method: string, operation: Operation) {
  const parameters = operation.parameters ?? [];
  const body = operation.requestBody?.content['application/json'].example;
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/^\{(.+)\}$/, ':$1'));
  const query = parameters
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => ({
      key: parameter.name,
      value: sampleValue(parameter),
      description: parameter.description,
      // Optional filters start switched off. Tick the ones you want to use.
      disabled: true,
    }));

  return {
    name: operation.summary,
    request: {
      method: method.toUpperCase(),
      header: body === undefined ? [] : [{ key: 'Content-Type', value: 'application/json' }],
      url: {
        raw: `{{baseUrl}}${path.replace(/\{(.+?)\}/g, ':$1')}`,
        host: ['{{baseUrl}}'],
        path: segments,
        query,
        variable: parameters
          .filter((parameter) => parameter.in === 'path')
          .map((parameter) => ({
            key: parameter.name,
            value: sampleValue(parameter),
            description: parameter.description,
          })),
      },
      ...(body !== undefined && {
        body: {
          mode: 'raw',
          raw: JSON.stringify(body, null, 2),
          options: { raw: { language: 'json' } },
        },
      }),
      description: operation.description ?? operation.summary,
    },
  };
}

/** @param baseUrl the address of the API, for example https://app.example.com/api */
export function toPostmanCollection(document: object, baseUrl: string) {
  const api = document as ApiDescription;
  const folders = new Map<string, ReturnType<typeof toRequestItem>[]>();

  for (const [path, operations] of Object.entries(api.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = operations[method];
      if (!operation) continue;
      const folder = operation.tags?.[0] ?? 'Other';
      const items = folders.get(folder) ?? [];
      items.push(toRequestItem(path, method, operation));
      folders.set(folder, items);
    }
  }

  return {
    info: {
      name: api.info.title,
      description: api.info.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    // Change this one value to point the whole collection at another server.
    variable: [{ key: 'baseUrl', value: baseUrl }],
    item: [...folders].map(([name, item]) => ({ name, item })),
  };
}
