import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '../app.js';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/appErrors.js';
import { errorHandler } from './errorHandler.js';
import { notFoundHandler } from './notFound.js';
import { requestId } from './requestId.js';

/** A tiny app that uses the real middleware, with routes that fail on purpose. */
function appThatThrows(error: unknown): Express {
  const app = express();
  app.use(requestId);
  app.get('/boom', () => {
    throw error;
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('error handling', () => {
  it('turns a ValidationError into 400 with field details', async () => {
    const app = appThatThrows(
      new ValidationError('Some fields are invalid.', [
        { field: 'amount', message: 'Amount must have at most two decimal places.' },
      ]),
    );

    const response = await request(app).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      details: [{ field: 'amount', message: 'Amount must have at most two decimal places.' }],
    });
  });

  it('turns a Zod error into 400 with one detail per failing field', async () => {
    const schema = z.object({ email: z.email(), age: z.number().min(18) });
    const zodError = schema.safeParse({ email: 'nope', age: 3 }).error;

    const response = await request(appThatThrows(zodError)).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const fields = response.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(['email', 'age']);
  });

  it('turns a NotFoundError into 404', async () => {
    const response = await request(appThatThrows(new NotFoundError('Employee not found.'))).get(
      '/boom',
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Employee not found.',
    });
  });

  it('turns a ConflictError into 409', async () => {
    const response = await request(
      appThatThrows(new ConflictError('That email is already used.')),
    ).get('/boom');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('turns a BusinessRuleError into 422', async () => {
    const response = await request(
      appThatThrows(new BusinessRuleError('The new amount is the same as the current amount.')),
    ).get('/boom');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('returns 404 NOT_FOUND for an unknown route', async () => {
    const response = await request(appThatThrows(new Error('unused'))).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Route not found.');
  });

  describe('unexpected errors', () => {
    const secretError = new Error('password authentication failed for user "acme" at 10.0.0.5');

    it('returns 500 with a generic message and no internal details', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const response = await request(appThatThrows(secretError)).get('/boom');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Something went wrong. Please try again.');
      const text = JSON.stringify(response.body);
      expect(text).not.toContain('password');
      expect(text).not.toContain('10.0.0.5');
      expect(text).not.toContain('stack');
      expect(response.body.error.details).toBeUndefined();
    });

    it('logs the real error so it can be investigated', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await request(appThatThrows(secretError)).get('/boom');

      expect(log).toHaveBeenCalled();
    });

    it('does not treat an error that merely has a status field as safe to show', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const sneaky = Object.assign(new Error('internal path /srv/app/db.ts'), { status: 418 });

      const response = await request(appThatThrows(sneaky)).get('/boom');

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain('/srv/app');
    });
  });

  describe('request id', () => {
    it('adds an X-Request-Id header and repeats it in the error body', async () => {
      const response = await request(appThatThrows(new NotFoundError('x'))).get('/boom');

      const headerId = response.headers['x-request-id'];
      expect(headerId).toMatch(/^[\w-]{8,}$/);
      expect(response.body.error.requestId).toBe(headerId);
    });

    it('gives each request its own id', async () => {
      const app = appThatThrows(new NotFoundError('x'));

      const first = await request(app).get('/boom');
      const second = await request(app).get('/boom');

      expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
    });
  });
});

describe('the real app', () => {
  const app = createApp({ checkDatabase: () => Promise.resolve(true) });

  it('returns the standard 404 body for an unknown route', async () => {
    const response = await request(app).get('/api/nothing-here');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for malformed JSON, not a stack trace', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('SyntaxError');
  });

  it('sends security headers', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
