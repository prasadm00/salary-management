import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const validSource = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' };

describe('loadEnv', () => {
  it('reads the database url and applies defaults for the rest', () => {
    const env = loadEnv(validSource);

    expect(env).toEqual({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: 4000,
      NODE_ENV: 'development',
      CORS_ORIGIN: undefined,
    });
  });

  it('throws a clear error naming DATABASE_URL when it is missing', () => {
    expect(() => loadEnv({})).toThrowError(/DATABASE_URL/);
    expect(() => loadEnv({})).toThrowError(/Invalid environment configuration/);
  });

  it('throws when DATABASE_URL is not a postgres connection string', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrowError(/DATABASE_URL/);
  });

  it('converts PORT from text to a number', () => {
    expect(loadEnv({ ...validSource, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['0', '70000', 'abc', '-1', '80.5'])('rejects the invalid PORT "%s"', (port) => {
    expect(() => loadEnv({ ...validSource, PORT: port })).toThrowError(/PORT/);
  });

  it('accepts only known NODE_ENV values', () => {
    expect(loadEnv({ ...validSource, NODE_ENV: 'production' }).NODE_ENV).toBe('production');
    expect(() => loadEnv({ ...validSource, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('keeps an optional CORS_ORIGIN when given', () => {
    const env = loadEnv({ ...validSource, CORS_ORIGIN: 'http://localhost:5173' });

    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('never prints the secret value in the error message', () => {
    const attempt = () => loadEnv({ DATABASE_URL: 'mysql://user:supersecret@host/db' });

    expect(attempt).toThrowError();
    expect(attempt).not.toThrowError(/supersecret/);
  });
});
