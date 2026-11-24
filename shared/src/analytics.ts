import type { CurrencyView } from './employee.js';

/** Shown next to every USD figure, so nobody mistakes the fixed rates for market data. */
export interface UsdViewLabel {
  /** The date the fixed rates are as of, YYYY-MM-DD. */
  ratesAsOf: string;
  ratesNote: string;
}

/** Salary figures for a group of people. Every amount is text with two decimals. */
export interface SalaryStats {
  headcount: number;
  min: string;
  max: string;
  average: string;
  /** The middle salary. With an even headcount, the average of the two middle ones. */
  median: string;
  /** 25th percentile, nearest-rank method. */
  p25: string;
  p75: string;
}

/** Stats for the people paid in one currency. Currencies are never combined (R-35). */
export interface CurrencyStats extends SalaryStats {
  currency: string;
}

/** Stats for one group (a country, department or level) in one currency. */
export interface GroupStatsRow extends CurrencyStats {
  key: string;
}

export type StatsGroupBy = 'country' | 'department' | 'level';

/** GET /api/analytics/summary */
export interface SummaryResponse extends Partial<UsdViewLabel> {
  view: CurrencyView;
  /** People matching the filters, in every currency. */
  headcount: number;
  groups: CurrencyStats[];
}

/** GET /api/analytics/by-country, /by-department, /by-level */
export interface GroupedStatsResponse extends Partial<UsdViewLabel> {
  view: CurrencyView;
  groupBy: StatsGroupBy;
  headcount: number;
  rows: GroupStatsRow[];
}

export interface Bucket {
  /** Included. */
  from: string;
  /** Excluded, except in the last bucket, which includes it. */
  to: string;
  count: number;
}

/** GET /api/analytics/distribution */
export interface DistributionResponse extends Partial<UsdViewLabel> {
  view: CurrencyView;
  currency: string;
  headcount: number;
  /** Null when nobody matches. */
  min: string | null;
  max: string | null;
  buckets: Bucket[];
}

export interface ExtremeEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  department: string;
  level: string;
  country: string;
  amount: string;
}

/** GET /api/analytics/extremes */
export interface ExtremesResponse extends Partial<UsdViewLabel> {
  view: CurrencyView;
  currency: string;
  /** Highest paid first. */
  top: ExtremeEmployee[];
  /** Lowest paid first. */
  bottom: ExtremeEmployee[];
}

export interface RecentChange {
  id: number;
  employee: { id: number; employeeCode: string; fullName: string };
  oldAmount: string;
  newAmount: string;
  currency: string;
  reason: string;
  changedAt: string;
}

/** GET /api/analytics/recent-changes */
export interface RecentChangesResponse {
  data: RecentChange[];
}
