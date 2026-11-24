/**
 * Builds a "contains" pattern for SQL `ILIKE`, such as `%priya%`.
 *
 * `%` and `_` are wildcards in a LIKE pattern, and `\` is the escape character.
 * Each is escaped, so what the user types is searched for literally:
 * typing "%" finds a percent sign, it does not match every row.
 * (SQL injection is a separate matter: the pattern is always sent as a parameter.)
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
