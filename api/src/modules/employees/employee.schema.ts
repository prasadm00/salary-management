import { EMPLOYMENT_STATUSES, LEVELS } from '@acme/shared';
import { z } from 'zod';
import { isRealIsoDate } from '../../domain/clock.js';
import { isKnownCountry } from '../../domain/currency.js';
import { moneyField } from '../../validation/moneyField.js';

/** "<Label> is required." when the field is missing, a type message otherwise. */
const requiredError = (label: string, expected: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? `${label} is required.` : `${label} must be ${expected}.`;

/** Required text, trimmed, with a maximum length. */
const text = (label: string, maxLength: number) =>
  z
    .string({ error: requiredError(label, 'text') })
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(maxLength, { error: `${label} must be at most ${maxLength} characters.` });

/** Body of POST /api/employees (docs/API.md section 2.3). Unknown fields are rejected. */
export const createEmployeeSchema = z.strictObject({
  fullName: text('Full name', 120),
  email: z
    .string({ error: requiredError('Email', 'text') })
    .trim()
    .toLowerCase()
    .max(160, { error: 'Email must be at most 160 characters.' })
    .pipe(z.email({ error: 'Enter a valid email address.' })),
  department: text('Department', 60),
  jobTitle: text('Job title', 80),
  level: z.enum(LEVELS, { error: 'Level must be one of L1 to L6.' }),
  country: z
    .string({ error: requiredError('Country', 'text') })
    .refine(isKnownCountry, { error: 'Country is not supported.' }),
  hireDate: z
    .string({ error: requiredError('Hire date', 'a real date in the form YYYY-MM-DD') })
    .refine(isRealIsoDate, { error: 'Hire date must be a real date in the form YYYY-MM-DD.' }),
  salary: moneyField('salary'),
});

/** A validated create request, as the service receives it. */
export type CreateEmployeeInput = z.output<typeof createEmployeeSchema>;

const ID_MESSAGE = 'Employee id must be a positive whole number.';
const MAX_ID = 2_147_483_647; // the largest value of a PostgreSQL integer

/** The `:id` part of the URL. Text such as "1e3" or "0x10" is rejected on purpose. */
export const employeeIdParamSchema = z.object({
  id: z
    .string({ error: ID_MESSAGE })
    .regex(/^[1-9]\d{0,9}$/, { error: ID_MESSAGE })
    .transform(Number)
    .refine((id) => id <= MAX_ID, { error: ID_MESSAGE }),
});

/** Body of PATCH /api/employees/:id/status. */
export const updateStatusSchema = z.strictObject({
  status: z.enum(EMPLOYMENT_STATUSES, { error: 'Status must be ACTIVE or INACTIVE.' }),
});
