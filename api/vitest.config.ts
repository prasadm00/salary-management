import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Applies migrations to the test database once, before any test file runs.
    globalSetup: ['src/tests/globalSetup.ts'],
    // Database tests share one PostgreSQL test database, so files run one at a time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/tests/**', 'src/server.ts', 'src/generated/**'],
    },
  },
});
