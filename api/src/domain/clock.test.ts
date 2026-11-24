import { describe, expect, it } from 'vitest';
import { isRealIsoDate, systemClock, toIsoDate } from './clock.js';

describe('toIsoDate', () => {
  it('gives the UTC calendar date', () => {
    expect(toIsoDate(new Date('2026-11-01T09:00:00.000Z'))).toBe('2026-11-01');
  });

  it('uses UTC, so late evening UTC stays on the same day', () => {
    expect(toIsoDate(new Date('2026-11-01T23:59:59.999Z'))).toBe('2026-11-01');
  });
});

describe('isRealIsoDate', () => {
  it.each(['2021-04-12', '2024-02-29', '2000-02-29', '1999-12-31'])('accepts %s', (text) => {
    expect(isRealIsoDate(text)).toBe(true);
  });

  it.each([
    '2021-02-30',
    '2023-02-29',
    '1900-02-29',
    '2021-13-01',
    '2021-00-10',
    '2021-04-31',
    '2021-4-12',
    '12/04/2021',
    '2021-04-12T00:00:00Z',
    '',
    'tomorrow',
  ])('rejects "%s"', (text) => {
    expect(isRealIsoDate(text)).toBe(false);
  });
});

describe('systemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();

    const now = systemClock.now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
