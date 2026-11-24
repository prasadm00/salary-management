import {
  COUNTRIES,
  EMPLOYMENT_STATUSES,
  LEVELS,
  USD_RATES_AS_OF,
  type FilterOptions,
} from '@acme/shared';
import type { EmployeeQueryRepository } from '../employees/employeeQuery.repository.js';

/** The choices offered by the filter dropdowns (US-03 AC4). They come from the data, not from hard-coded lists. */
export class MetaService {
  constructor(private readonly repository: EmployeeQueryRepository) {}

  /**
   * Countries and departments that at least one employee has (inactive employees count),
   * plus the fixed lists of levels and statuses. Always sorted the same way.
   */
  async filters(): Promise<FilterOptions> {
    const [countryCodes, departments] = await Promise.all([
      this.repository.distinctCountries(),
      this.repository.distinctDepartments(),
    ]);

    // Only countries we know about are offered. The names and currencies come from the reference data.
    const present = new Set(countryCodes);
    const countries = COUNTRIES.filter((country) => present.has(country.code))
      .map(({ code, name, currency }) => ({ code, name, currency }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));

    return {
      countries,
      currencies: [...new Set(countries.map((country) => country.currency))].sort(),
      departments: [...departments].sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: 'base' }),
      ),
      levels: [...LEVELS],
      statuses: [...EMPLOYMENT_STATUSES],
      ratesAsOf: USD_RATES_AS_OF,
    };
  }
}
