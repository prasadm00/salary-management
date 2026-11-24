import { describe, expect, it } from 'vitest';
import { formatEmployeeCode } from './employeeCode.js';

describe('R-25: employee codes are EMP- plus six digits', () => {
  it.each([
    [1, 'EMP-000001'],
    [42, 'EMP-000042'],
    [10000, 'EMP-010000'],
    [999999, 'EMP-999999'],
  ])('turns id %i into %s', (id, code) => {
    expect(formatEmployeeCode(id)).toBe(code);
  });

  it('keeps every digit once the id passes six digits instead of cutting it', () => {
    expect(formatEmployeeCode(1234567)).toBe('EMP-1234567');
  });
});
