const CODE_PREFIX = 'EMP-';
const MIN_DIGITS = 6;

/**
 * R-25: the human-friendly code is built from the employee id, for example 1 gives "EMP-000001".
 * Building it from the id means two employees can never get the same code.
 */
export function formatEmployeeCode(id: number): string {
  return `${CODE_PREFIX}${String(id).padStart(MIN_DIGITS, '0')}`;
}
