import {
  USD_RATES_AS_OF,
  USD_RATES_NOTE,
  type CurrencyStats,
  type CurrencyView,
  type DistributionResponse,
  type ExtremesResponse,
  type GroupedStatsResponse,
  type RecentChangesResponse,
  type StatsGroupBy,
  type SummaryResponse,
  type UsdViewLabel,
} from '@acme/shared';
import { ValidationError } from '../../errors/appErrors.js';
import type { AnalyticsRepository, StatsRowData } from './analytics.repository.js';
import type { AnalyticsFilters, DistributionQuery, ExtremesQuery } from './analytics.schema.js';

/** Use cases for understanding how the organisation pays people (US-10 to US-14). */
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  /** Headcount, and statistics per currency (US-10, US-11). */
  async summary(filters: AnalyticsFilters): Promise<SummaryResponse> {
    const [headcount, rows] = await Promise.all([
      this.repository.countEmployees(filters),
      this.repository.groupStats('none', filters),
    ]);

    return {
      view: filters.view,
      ...usdLabel(filters.view),
      headcount,
      groups: rows.map(toCurrencyStats),
    };
  }

  /** Headcount and statistics per country, department or level, split by currency (US-10, US-11). */
  async byGroup(groupBy: StatsGroupBy, filters: AnalyticsFilters): Promise<GroupedStatsResponse> {
    const [headcount, rows] = await Promise.all([
      this.repository.countEmployees(filters),
      this.repository.groupStats(groupBy, filters),
    ]);

    return {
      view: filters.view,
      groupBy,
      ...usdLabel(filters.view),
      headcount,
      // A grouped query always has a key. The fallback keeps the types honest.
      rows: rows.map((row) => ({ key: row.key ?? '', ...toCurrencyStats(row) })),
    };
  }

  /**
   * How salaries are spread across equal-width ranges (US-12).
   * @throws ValidationError in the local view when no currency is given
   */
  async distribution(query: DistributionQuery): Promise<DistributionResponse> {
    const { currency, buckets, ...filters } = query;
    const chosen = chosenCurrency(filters.view, currency);

    const data = await this.repository.distribution(filters, chosen, buckets);
    return {
      view: filters.view,
      ...usdLabel(filters.view),
      currency: chosen ?? 'USD',
      ...data,
    };
  }

  /**
   * The highest and lowest paid people (US-14).
   * @throws ValidationError in the local view when no currency is given
   */
  async extremes(query: ExtremesQuery): Promise<ExtremesResponse> {
    const { currency, limit, ...filters } = query;
    const chosen = chosenCurrency(filters.view, currency);

    const { top, bottom } = await this.repository.extremes(filters, chosen, limit);
    return {
      view: filters.view,
      ...usdLabel(filters.view),
      currency: chosen ?? 'USD',
      top,
      bottom,
    };
  }

  /** The latest salary changes, newest first (US-14). */
  async recentChanges(limit: number): Promise<RecentChangesResponse> {
    return { data: await this.repository.recentChanges(limit) };
  }
}

/** The USD view says so, with the date of the rates and a plain warning (US-13). */
function usdLabel(view: CurrencyView): Partial<UsdViewLabel> {
  return view === 'usd' ? { ratesAsOf: USD_RATES_AS_OF, ratesNote: USD_RATES_NOTE } : {};
}

/**
 * Salaries in different currencies cannot share a chart or a ranking, so the local view
 * needs one currency. The USD view needs none, because everything is converted. A currency
 * sent with the USD view is ignored.
 */
function chosenCurrency(view: CurrencyView, currency: string | undefined): string | undefined {
  if (view === 'usd') return undefined;
  if (!currency) {
    throw new ValidationError('Some fields are invalid.', [
      { field: 'currency', message: 'Currency is required in the local view.' },
    ]);
  }
  return currency;
}

function toCurrencyStats(row: StatsRowData): CurrencyStats {
  return {
    currency: row.currency,
    headcount: row.headcount,
    min: row.min,
    max: row.max,
    average: row.average,
    median: row.median,
    p25: row.p25,
    p75: row.p75,
  };
}
