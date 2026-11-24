import type { Clock } from '../domain/clock.js';

/** The "current time" used by tests: 2026-11-01 09:00 UTC. */
export const TEST_NOW = '2026-11-01T09:00:00.000Z';

/** A clock that always returns the same moment, so tests never depend on the real date. */
export function fixedClock(iso: string = TEST_NOW): Clock {
  return { now: () => new Date(iso) };
}

/** A clock a test can move forward, to check ordering by time. */
export function movableClock(startIso: string = TEST_NOW): Clock & { set(iso: string): void } {
  let current = new Date(startIso);
  return {
    now: () => current,
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}
