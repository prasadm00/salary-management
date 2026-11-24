import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
      error: 'DATABASE_URL must be a PostgreSQL connection string (postgresql://...)',
    }),
  PORT: z.coerce
    .number()
    .int({ error: 'PORT must be a whole number' })
    .min(1, { error: 'PORT must be between 1 and 65535' })
    .max(65535, { error: 'PORT must be between 1 and 65535' })
    .default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Origin allowed by CORS. Not needed when the API also serves the UI. */
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Reads and checks configuration. Fails fast with a readable message,
 * and never includes the rejected value, because it may be a secret.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
