import { describe, expect, it } from 'vitest';
import { assertSafeToSeed } from './safety.js';

describe('assertSafeToSeed', () => {
  it.each([
    'postgresql://acme:acme@localhost:5432/salary_management',
    'postgresql://acme:acme@127.0.0.1:5432/salary_management',
    'postgresql://acme:acme@[::1]:5432/salary_management',
  ])('allows a database on this computer: %s', (url) => {
    expect(() => assertSafeToSeed(url, undefined)).not.toThrow();
  });

  it('refuses a database somewhere else unless SEED_CONFIRM=yes', () => {
    const url = 'postgresql://user:secret@ep-cool-db.neon.tech/neondb';

    expect(() => assertSafeToSeed(url, undefined)).toThrowError(/SEED_CONFIRM=yes/);
    expect(() => assertSafeToSeed(url, 'no')).toThrowError(/SEED_CONFIRM=yes/);
    expect(() => assertSafeToSeed(url, 'yes')).not.toThrow();
  });

  it('does not treat a host that only starts with "localhost" as local', () => {
    const url = 'postgresql://user:secret@localhost.evil.example/db';

    expect(() => assertSafeToSeed(url, undefined)).toThrowError(/SEED_CONFIRM=yes/);
  });

  it('never prints the password', () => {
    const attempt = () =>
      assertSafeToSeed('postgresql://user:hunter2@db.example.com/db', undefined);

    expect(attempt).toThrowError();
    expect(attempt).not.toThrowError(/hunter2/);
  });

  it('refuses a connection string it cannot read', () => {
    expect(() => assertSafeToSeed('not a url', 'yes')).toThrowError(/DATABASE_URL/);
  });
});
