import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Switch to 'jsdom' when the first component test is added.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/tests/**', 'src/main.tsx'],
    },
  },
});
