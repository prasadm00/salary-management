import type { EmploymentStatus, Level } from './employee.js';

/** The values the filter dropdowns offer (GET /api/meta/filters). */
export interface FilterOptions {
  /** Only countries that have employees, sorted by name. */
  countries: { code: string; name: string; currency: string }[];
  /** The currencies of those countries, once each, sorted. */
  currencies: string[];
  /** Only departments that have employees, sorted. */
  departments: string[];
  levels: Level[];
  statuses: EmploymentStatus[];
  /** The date the fixed USD rates are as of, YYYY-MM-DD. */
  ratesAsOf: string;
}
