/**
 * The API description (OpenAPI 3). It feeds three things: the Swagger page at /api/docs,
 * the file at /api/openapi.json, and the downloadable Postman collection.
 * A test calls every documented endpoint, so this file cannot drift from the real routes unnoticed.
 */

type Json = Record<string, unknown>;

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const STATUSES = ['ACTIVE', 'INACTIVE'];
const SORT_COLUMNS = [
  'fullName',
  'employeeCode',
  'salary',
  'hireDate',
  'department',
  'country',
  'level',
];

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema: Json, example?: unknown): Json => ({
  'application/json': { schema, ...(example !== undefined && { example }) },
});
const ok = (description: string, schema: Json): Json => ({
  description,
  content: jsonBody(schema),
});
const errorResponse = (description: string): Json => ({
  description,
  content: jsonBody(ref('Error')),
});

const query = (name: string, description: string, schema: Json): Json => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
});

const idParam: Json = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Employee id (a positive whole number).',
  schema: { type: 'integer', minimum: 1 },
  example: 1,
};

const whole = (min: number, max: number, def: number): Json => ({
  type: 'integer',
  minimum: min,
  maximum: max,
  default: def,
});

const viewParam = query(
  'view',
  '`local` keeps each currency separate. `usd` converts to US dollars at fixed, illustrative rates (see `ratesAsOf` in the answer).',
  { type: 'string', enum: ['local', 'usd'], default: 'local' },
);

/** Filters shared by the statistics endpoints. */
const statsFilters: Json[] = [
  query('country', 'Country code, for example `IN`.', { type: 'string' }),
  query('department', 'Department name.', { type: 'string' }),
  query('level', 'Job level.', { type: 'string', enum: LEVELS }),
  query('status', 'Which employees to count.', {
    type: 'string',
    enum: [...STATUSES, 'ALL'],
    default: 'ACTIVE',
  }),
  viewParam,
];

const currencyParam = query('currency', 'Currency to analyse, for example `INR`.', {
  type: 'string',
});

const usdNote = {
  ratesAsOf: { type: 'string', format: 'date', description: 'Only with `view=usd`.' },
  ratesNote: { type: 'string', description: 'Only with `view=usd`.' },
};

const salaryStats = {
  headcount: { type: 'integer', example: 433 },
  min: { type: 'string', example: '31000.00' },
  max: { type: 'string', example: '312400.00' },
  average: { type: 'string', example: '102400.00' },
  median: { type: 'string', example: '98100.00' },
  p25: { type: 'string', example: '70200.00' },
  p75: { type: 'string', example: '131000.00' },
};

const list = (itemSchema: Json): Json => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: itemSchema },
    page: { type: 'integer', example: 1 },
    pageSize: { type: 'integer', example: 25 },
    total: { type: 'integer', example: 10000 },
  },
});

const validation = errorResponse('The input is not valid (`VALIDATION_ERROR`).');
const notFound = errorResponse('No such employee (`NOT_FOUND`).');

export const openApiDocument: Json = {
  openapi: '3.0.3',
  info: {
    title: 'ACME Salary Management API',
    version: '1.0.0',
    description: [
      'API for an HR manager to find employees, change salaries and see how the organisation pays people.',
      '',
      '- **Money** is always text, such as `"105500.00"`, never a number. Each amount comes with its currency.',
      "- **Currency** follows the employee's country. It cannot be chosen.",
      '- **Salary history** is never edited. Every change adds a record with a reason.',
      '- **No login.** The data is fictional, so anyone can call every endpoint.',
      '- Errors always look like `{ "error": { "code", "message", "details?", "requestId" } }`.',
      '',
      'Use **Try it out** below, or download the Postman collection from `/api/docs/postman-collection.json`.',
    ].join('\n'),
  },
  servers: [{ url: '/api', description: 'This server' }],
  tags: [
    { name: 'Health' },
    { name: 'Reference data' },
    { name: 'Employees' },
    { name: 'Salary' },
    { name: 'Analytics' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Is the service and its database up?',
        responses: {
          '200': ok('Running.', {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              database: { type: 'string', example: 'up' },
              uptimeSeconds: { type: 'integer', example: 3600 },
            },
          }),
          '503': {
            description: 'The database cannot be reached.',
            content: jsonBody({
              type: 'object',
              properties: {
                status: { type: 'string', example: 'degraded' },
                database: { type: 'string', example: 'down' },
              },
            }),
          },
        },
      },
    },
    '/meta/filters': {
      get: {
        tags: ['Reference data'],
        summary: 'Values for the filter lists',
        description: 'Countries (with their currency), departments, levels and statuses.',
        responses: { '200': ok('The available values.', ref('FilterOptions')) },
      },
    },
    '/employees': {
      get: {
        tags: ['Employees'],
        summary: 'Search, filter, sort and page through employees',
        description:
          'Sorting by `salary` without a `currency` compares amounts in US dollars. With a `currency`, amounts are compared directly.',
        parameters: [
          query('q', 'Text to find in the name, email or employee code (at most 100 characters).', {
            type: 'string',
            maxLength: 100,
          }),
          query('country', 'Country code, for example `IN`.', { type: 'string' }),
          query('department', 'Department name.', { type: 'string' }),
          query('level', 'Job level.', { type: 'string', enum: LEVELS }),
          query('status', 'Employment status.', { type: 'string', enum: STATUSES }),
          query('currency', 'Only people paid in this currency.', { type: 'string' }),
          query('sortBy', 'Column to sort by.', {
            type: 'string',
            enum: SORT_COLUMNS,
            default: 'fullName',
          }),
          query('sortDir', 'Sort direction.', {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'asc',
          }),
          viewParam,
          query('page', 'Page number, starting at 1.', whole(1, 1_000_000, 1)),
          query('pageSize', 'People per page.', whole(1, 100, 25)),
        ],
        responses: {
          '200': ok('One page of employees.', list(ref('Employee'))),
          '400': validation,
        },
      },
      post: {
        tags: ['Employees'],
        summary: 'Add an employee',
        description:
          'The currency is set from the country. The starting salary is recorded as the first salary history entry.',
        requestBody: {
          required: true,
          content: jsonBody(ref('NewEmployee'), {
            fullName: 'Asha Rao',
            email: 'asha.rao@acme.example',
            department: 'Engineering',
            jobTitle: 'Software Engineer',
            level: 'L3',
            country: 'IN',
            hireDate: '2026-01-15',
            salary: '2400000.00',
          }),
        },
        responses: {
          '201': ok('The new employee. The `Location` header has its address.', ref('Employee')),
          '400': validation,
          '409': errorResponse('That email address is already used (`CONFLICT`).'),
        },
      },
    },
    '/employees/{id}': {
      get: {
        tags: ['Employees'],
        summary: 'One employee, with the current salary',
        parameters: [idParam],
        responses: {
          '200': ok('The employee.', ref('Employee')),
          '400': validation,
          '404': notFound,
        },
      },
    },
    '/employees/{id}/status': {
      patch: {
        tags: ['Employees'],
        summary: 'Mark an employee active or inactive',
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonBody(
            {
              type: 'object',
              required: ['status'],
              properties: { status: { type: 'string', enum: STATUSES } },
            },
            { status: 'INACTIVE' },
          ),
        },
        responses: {
          '200': ok('The updated employee.', ref('Employee')),
          '400': validation,
          '404': notFound,
        },
      },
    },
    '/employees/{id}/compensation': {
      patch: {
        tags: ['Salary'],
        summary: 'Change the salary',
        description:
          "Adds a history record with the reason. The new amount is in the employee's own currency.",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonBody(
            {
              type: 'object',
              required: ['amount', 'reason'],
              properties: {
                amount: {
                  type: 'string',
                  example: '2500000.00',
                  description: 'The new yearly salary, as text.',
                },
                reason: { type: 'string', minLength: 3, maxLength: 255, example: 'Annual review' },
              },
            },
            { amount: '2500000.00', reason: 'Annual review' },
          ),
        },
        responses: {
          '200': ok('The updated employee.', ref('Employee')),
          '400': validation,
          '404': notFound,
          '422': errorResponse(
            'The amount is the same as the current salary (`BUSINESS_RULE_VIOLATION`).',
          ),
        },
      },
    },
    '/employees/{id}/compensation-history': {
      get: {
        tags: ['Salary'],
        summary: 'Every salary change for one employee, newest first',
        parameters: [
          idParam,
          query('page', 'Page number, starting at 1.', whole(1, 1_000_000, 1)),
          query('pageSize', 'Changes per page.', whole(1, 100, 25)),
        ],
        responses: {
          '200': ok('One page of changes.', list(ref('CompensationChange'))),
          '400': validation,
          '404': notFound,
        },
      },
    },
    '/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Headcount and salary statistics, one group per currency',
        parameters: statsFilters,
        responses: {
          '200': ok('Statistics.', {
            type: 'object',
            properties: {
              view: { type: 'string', enum: ['local', 'usd'] },
              headcount: { type: 'integer' },
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { currency: { type: 'string', example: 'INR' }, ...salaryStats },
                },
              },
              ...usdNote,
            },
          }),
          '400': validation,
        },
      },
    },
    ...Object.fromEntries(
      [
        ['by-country', 'country'],
        ['by-department', 'department'],
        ['by-level', 'level'],
      ].map(([path, groupBy]) => [
        `/analytics/${path}`,
        {
          get: {
            tags: ['Analytics'],
            summary: `Salary statistics for each ${groupBy}`,
            parameters: statsFilters,
            responses: {
              '200': ok('Statistics, one row per group and currency.', {
                type: 'object',
                properties: {
                  view: { type: 'string', enum: ['local', 'usd'] },
                  groupBy: { type: 'string', example: groupBy },
                  headcount: { type: 'integer' },
                  rows: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string', example: groupBy === 'level' ? 'L3' : 'IN' },
                        currency: { type: 'string', example: 'INR' },
                        ...salaryStats,
                      },
                    },
                  },
                  ...usdNote,
                },
              }),
              '400': validation,
            },
          },
        },
      ]),
    ),
    '/analytics/distribution': {
      get: {
        tags: ['Analytics'],
        summary: 'Salary histogram: how many people are in each pay range',
        parameters: [
          ...statsFilters,
          currencyParam,
          query('buckets', 'Number of ranges.', whole(5, 30, 10)),
        ],
        responses: {
          '200': ok('The ranges.', {
            type: 'object',
            properties: {
              view: { type: 'string', enum: ['local', 'usd'] },
              currency: { type: 'string', example: 'INR' },
              headcount: { type: 'integer' },
              min: { type: 'string', nullable: true },
              max: { type: 'string', nullable: true },
              buckets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', example: '603800.00' },
                    to: { type: 'string', example: '1600000.00' },
                    count: { type: 'integer', example: 812 },
                  },
                },
              },
              ...usdNote,
            },
          }),
          '400': validation,
        },
      },
    },
    '/analytics/extremes': {
      get: {
        tags: ['Analytics'],
        summary: 'Highest and lowest paid employees',
        parameters: [
          ...statsFilters,
          currencyParam,
          query('limit', 'How many people in each list.', whole(1, 25, 10)),
        ],
        responses: {
          '200': ok('The two lists.', {
            type: 'object',
            properties: {
              view: { type: 'string', enum: ['local', 'usd'] },
              currency: { type: 'string', example: 'INR' },
              top: { type: 'array', items: ref('ExtremeEmployee') },
              bottom: { type: 'array', items: ref('ExtremeEmployee') },
              ...usdNote,
            },
          }),
          '400': validation,
        },
      },
    },
    '/analytics/recent-changes': {
      get: {
        tags: ['Analytics'],
        summary: 'The latest salary changes across all employees',
        parameters: [query('limit', 'How many changes.', whole(1, 25, 10))],
        responses: {
          '200': ok('Newest first.', {
            type: 'object',
            properties: { data: { type: 'array', items: ref('RecentChange') } },
          }),
          '400': validation,
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                enum: [
                  'VALIDATION_ERROR',
                  'NOT_FOUND',
                  'CONFLICT',
                  'BUSINESS_RULE_VIOLATION',
                  'INTERNAL_ERROR',
                  'SERVICE_UNAVAILABLE',
                ],
              },
              message: { type: 'string', example: 'Employee not found.' },
              details: { type: 'array', items: { type: 'object' } },
              requestId: { type: 'string' },
            },
          },
        },
      },
      Compensation: {
        type: 'object',
        properties: {
          amount: { type: 'string', example: '2400000.00' },
          currency: { type: 'string', example: 'INR' },
          effectiveDate: { type: 'string', format: 'date', example: '2026-01-15' },
        },
      },
      Employee: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          employeeCode: { type: 'string', example: 'EMP-000001' },
          fullName: { type: 'string', example: 'Asha Rao' },
          email: { type: 'string', example: 'asha.rao@acme.example' },
          department: { type: 'string', example: 'Engineering' },
          jobTitle: { type: 'string', example: 'Software Engineer' },
          level: { type: 'string', enum: LEVELS },
          country: { type: 'string', example: 'IN' },
          employmentStatus: { type: 'string', enum: STATUSES },
          hireDate: { type: 'string', format: 'date', example: '2026-01-15' },
          compensation: ref('Compensation'),
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      NewEmployee: {
        type: 'object',
        required: [
          'fullName',
          'email',
          'department',
          'jobTitle',
          'level',
          'country',
          'hireDate',
          'salary',
        ],
        description: 'Unknown fields are refused. The currency comes from the country.',
        properties: {
          fullName: { type: 'string', maxLength: 120 },
          email: { type: 'string', format: 'email', maxLength: 160 },
          department: { type: 'string', maxLength: 60 },
          jobTitle: { type: 'string', maxLength: 80 },
          level: { type: 'string', enum: LEVELS },
          country: { type: 'string', description: 'Country code from `/meta/filters`.' },
          hireDate: { type: 'string', format: 'date' },
          salary: {
            type: 'string',
            description: "Yearly salary as text, in the country's currency.",
          },
        },
      },
      CompensationChange: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employeeId: { type: 'integer' },
          oldAmount: {
            type: 'string',
            nullable: true,
            description: 'Empty for the starting salary.',
          },
          newAmount: { type: 'string', example: '2500000.00' },
          currency: { type: 'string', example: 'INR' },
          reason: { type: 'string', example: 'Annual review' },
          changedAt: { type: 'string', format: 'date-time' },
        },
      },
      RecentChange: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employee: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              employeeCode: { type: 'string' },
              fullName: { type: 'string' },
            },
          },
          oldAmount: { type: 'string' },
          newAmount: { type: 'string' },
          currency: { type: 'string' },
          reason: { type: 'string' },
          changedAt: { type: 'string', format: 'date-time' },
        },
      },
      ExtremeEmployee: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employeeCode: { type: 'string' },
          fullName: { type: 'string' },
          department: { type: 'string' },
          level: { type: 'string' },
          country: { type: 'string' },
          amount: { type: 'string', example: '10351800.00' },
        },
      },
      FilterOptions: {
        type: 'object',
        properties: {
          countries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'IN' },
                name: { type: 'string', example: 'India' },
                currency: { type: 'string', example: 'INR' },
              },
            },
          },
          currencies: { type: 'array', items: { type: 'string' } },
          departments: { type: 'array', items: { type: 'string' } },
          levels: { type: 'array', items: { type: 'string', enum: LEVELS } },
          statuses: { type: 'array', items: { type: 'string', enum: STATUSES } },
          ratesAsOf: { type: 'string', format: 'date' },
        },
      },
    },
  },
};
