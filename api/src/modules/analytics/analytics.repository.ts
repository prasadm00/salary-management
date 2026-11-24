import type { ExtremeEmployee, RecentChange, StatsGroupBy } from '@acme/shared';
import type { AnalyticsFilters } from './analytics.schema.js';

/** What to group people by. `none` means one group per currency for everyone. */
export type GroupBy = 'none' | StatsGroupBy;

/** One group of people in one currency. Every amount is text with two decimals. */
export interface StatsRowData {
  /** The country code, department or level. Null when not grouping (`none`). */
  key: string | null;
  currency: string;
  headcount: number;
  min: string;
  max: string;
  average: string;
  median: string;
  p25: string;
  p75: string;
}

export interface DistributionData {
  headcount: number;
  /** Null when nobody matches. */
  min: string | null;
  max: string | null;
  buckets: { from: string; to: string; count: number }[];
}

export interface ExtremeRows {
  /** Highest paid first. */
  top: ExtremeEmployee[];
  /** Lowest paid first. */
  bottom: ExtremeEmployee[];
}

export type RecentChangeRow = RecentChange;

/**
 * Read-only questions about how the organisation pays people.
 * The PostgreSQL implementation does all the counting and statistics in the database
 * (R-36), so the 10,000 rows never reach the server. It holds no business rules.
 *
 * Every method follows `filters.view`: in the `local` view each currency stays on its own,
 * and in the `usd` view salaries are converted with the fixed rates and shown as USD.
 * Amounts are rounded to two decimals once, at the very end (R-38).
 */
export interface AnalyticsRepository {
  /** Number of people matching the filters, in every currency. */
  countEmployees(filters: AnalyticsFilters): Promise<number>;

  /**
   * Statistics per group and currency, ordered by key and then currency.
   * Groups nobody belongs to are not returned (R-39).
   */
  groupStats(groupBy: GroupBy, filters: AnalyticsFilters): Promise<StatsRowData[]>;

  /**
   * Salaries in `buckets` ranges of equal width. `currency` is given in the local view
   * and is undefined in the USD view.
   */
  distribution(
    filters: AnalyticsFilters,
    currency: string | undefined,
    buckets: number,
  ): Promise<DistributionData>;

  /** The `limit` highest and lowest paid people. Ties are ordered by id. */
  extremes(
    filters: AnalyticsFilters,
    currency: string | undefined,
    limit: number,
  ): Promise<ExtremeRows>;

  /** The latest salary changes, newest first. Starting salaries are not changes and are left out. */
  recentChanges(limit: number): Promise<RecentChangeRow[]>;
}
