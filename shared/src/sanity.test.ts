import { describe, expect, it } from 'vitest';

describe('shared test setup', () => {
  it('runs a test with vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
