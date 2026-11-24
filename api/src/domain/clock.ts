/**
 * The current time, behind an interface so tests can fix it.
 * Code never calls `new Date()` or `Date.now()` directly.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** The calendar date of a moment in UTC, as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True for text such as "2021-04-12" that is a real calendar date (not "2021-02-30"). */
export function isRealIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === text;
}
