import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { aNewEmployeeBody } from '../../tests/builders.js';
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  updateStatusSchema,
} from './employee.schema.js';

/** Returns "field: message" lines for every problem, so a test can compare them at a glance. */
function problemsOf(parse: () => unknown): string[] {
  try {
    parse();
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    }
    throw error;
  }
  return [];
}

const parseBody = (body: unknown) => () => createEmployeeSchema.parse(body);

describe('createEmployeeSchema', () => {
  it('accepts a valid body and turns the salary into Money', () => {
    const input = createEmployeeSchema.parse(aNewEmployeeBody());

    expect(input.fullName).toBe('Asha Rao');
    expect(input.salary.toString()).toBe('2000000.00');
  });

  it('trims text and lower-cases the email (R-21)', () => {
    const input = createEmployeeSchema.parse(
      aNewEmployeeBody({ fullName: '  Asha Rao  ', email: '  Asha.Rao@ACME.example ' }),
    );

    expect(input.fullName).toBe('Asha Rao');
    expect(input.email).toBe('asha.rao@acme.example');
  });

  it('R-20: lists every missing field with a readable message', () => {
    expect(problemsOf(parseBody({}))).toEqual([
      'fullName: Full name is required.',
      'email: Email is required.',
      'department: Department is required.',
      'jobTitle: Job title is required.',
      'level: Level must be one of L1 to L6.',
      'country: Country is required.',
      'hireDate: Hire date is required.',
      'salary: Salary is required.',
    ]);
  });

  it('treats blank text as missing', () => {
    expect(problemsOf(parseBody(aNewEmployeeBody({ fullName: '   ', jobTitle: '' })))).toEqual([
      'fullName: Full name is required.',
      'jobTitle: Job title is required.',
    ]);
  });

  it('rejects text that is too long', () => {
    const problems = problemsOf(
      parseBody(aNewEmployeeBody({ fullName: 'a'.repeat(121), department: 'd'.repeat(61) })),
    );

    expect(problems).toEqual([
      'fullName: Full name must be at most 120 characters.',
      'department: Department must be at most 60 characters.',
    ]);
  });

  it.each(['not-an-email', 'a@b', '@acme.example', 'a b@acme.example', ''])(
    'R-21: rejects the invalid email "%s"',
    (email) => {
      expect(problemsOf(parseBody(aNewEmployeeBody({ email })))).toEqual([
        'email: Enter a valid email address.',
      ]);
    },
  );

  it.each(['L0', 'L7', 'l3', 'Senior', 3])('R-24: rejects the level %s', (level) => {
    expect(problemsOf(parseBody(aNewEmployeeBody({ level })))).toEqual([
      'level: Level must be one of L1 to L6.',
    ]);
  });

  it.each(['XX', 'in', 'India', 'USA', ''])('R-24: rejects the country "%s"', (country) => {
    expect(problemsOf(parseBody(aNewEmployeeBody({ country })))).toEqual([
      'country: Country is not supported.',
    ]);
  });

  it.each(['2021-02-30', '12/04/2021', '2021-4-12', 'yesterday', '', 20210412])(
    'rejects the hire date %s',
    (hireDate) => {
      expect(problemsOf(parseBody(aNewEmployeeBody({ hireDate })))).toEqual([
        'hireDate: Hire date must be a real date in the form YYYY-MM-DD.',
      ]);
    },
  );

  describe('salary', () => {
    it.each([
      [2000000, 'Salary must be given as text, for example "2400000.00".'],
      ['-5', 'Salary must be greater than zero.'],
      ['0', 'Salary must be greater than zero.'],
      ['10.001', 'Salary must have at most two decimal places.'],
      ['1e6', 'Salary must be a plain number such as 2400000.00.'],
    ])('rejects %s', (salary, message) => {
      expect(problemsOf(parseBody(aNewEmployeeBody({ salary })))).toEqual([`salary: ${message}`]);
    });
  });

  it('rejects fields it does not know, so a client cannot send a currency', () => {
    const problems = problemsOf(
      parseBody(aNewEmployeeBody({ currency: 'USD', employeeCode: 'X' })),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/currency/);
  });

  it('rejects a body that is not an object', () => {
    expect(problemsOf(parseBody('hello')).length).toBeGreaterThan(0);
    expect(problemsOf(parseBody([]))).not.toEqual([]);
    expect(problemsOf(parseBody(null))).not.toEqual([]);
  });
});

describe('employeeIdParamSchema', () => {
  it('turns the id text from the URL into a number', () => {
    expect(employeeIdParamSchema.parse({ id: '42' })).toEqual({ id: 42 });
  });

  it.each(['abc', '0', '-1', '1.5', '', ' ', '2147483648', '99999999999999999999', '1e3'])(
    'rejects the id "%s"',
    (id) => {
      expect(problemsOf(() => employeeIdParamSchema.parse({ id }))).toEqual([
        'id: Employee id must be a positive whole number.',
      ]);
    },
  );
});

describe('updateStatusSchema', () => {
  it.each(['ACTIVE', 'INACTIVE'])('accepts %s', (status) => {
    expect(updateStatusSchema.parse({ status })).toEqual({ status });
  });

  it.each(['active', 'DELETED', '', 1, null])('rejects %s', (status) => {
    expect(problemsOf(() => updateStatusSchema.parse({ status }))).toEqual([
      'status: Status must be ACTIVE or INACTIVE.',
    ]);
  });

  it('rejects other fields', () => {
    expect(problemsOf(() => updateStatusSchema.parse({ status: 'ACTIVE', extra: 1 }))).toHaveLength(
      1,
    );
  });
});
