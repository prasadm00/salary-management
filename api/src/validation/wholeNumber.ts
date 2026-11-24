import { z } from 'zod';

/**
 * A whole number in a query string, between `min` and `max`.
 * Plain digits only, so "1e2", " 5", "5.0", "05" and "-1" are refused.
 * Query values arrive as text, and a repeated parameter arrives as a list, which is refused too.
 */
export function wholeNumber(message: string, min: number, max: number) {
  return z
    .string({ error: message })
    .regex(/^(0|[1-9]\d{0,9})$/, { error: message })
    .transform(Number)
    .refine((value) => value >= min && value <= max, { error: message });
}
