import type {
  AnalyticsRepository,
  DistributionData,
  ExtremeRows,
  GroupBy,
  RecentChangeRow,
  StatsRowData,
} from '../modules/analytics/analytics.repository.js';
import type { AnalyticsFilters } from '../modules/analytics/analytics.schema.js';

/**
 * A stand-in for the database, for unit tests of the analytics service.
 * It returns what the test gives it and remembers what it was asked.
 * The real SQL is tested against PostgreSQL, not here.
 */
export class FakeAnalyticsRepository implements AnalyticsRepository {
  calls: string[] = [];
  lastFilters: AnalyticsFilters | undefined;
  lastGroupBy: GroupBy | undefined;
  lastCurrency: string | undefined;
  lastBuckets: number | undefined;
  lastLimit: number | undefined;

  stats: StatsRowData[] = [];
  headcount = 0;
  distributionResult: DistributionData = { headcount: 0, min: null, max: null, buckets: [] };
  extremesResult: ExtremeRows = { top: [], bottom: [] };
  recent: RecentChangeRow[] = [];

  countEmployees(filters: AnalyticsFilters): Promise<number> {
    this.calls.push('countEmployees');
    this.lastFilters = filters;
    return Promise.resolve(this.headcount);
  }

  groupStats(groupBy: GroupBy, filters: AnalyticsFilters): Promise<StatsRowData[]> {
    this.calls.push('groupStats');
    this.lastGroupBy = groupBy;
    this.lastFilters = filters;
    return Promise.resolve(this.stats);
  }

  distribution(
    filters: AnalyticsFilters,
    currency: string | undefined,
    buckets: number,
  ): Promise<DistributionData> {
    this.calls.push('distribution');
    this.lastFilters = filters;
    this.lastCurrency = currency;
    this.lastBuckets = buckets;
    return Promise.resolve(this.distributionResult);
  }

  extremes(
    filters: AnalyticsFilters,
    currency: string | undefined,
    limit: number,
  ): Promise<ExtremeRows> {
    this.calls.push('extremes');
    this.lastFilters = filters;
    this.lastCurrency = currency;
    this.lastLimit = limit;
    return Promise.resolve(this.extremesResult);
  }

  recentChanges(limit: number): Promise<RecentChangeRow[]> {
    this.calls.push('recentChanges');
    this.lastLimit = limit;
    return Promise.resolve(this.recent);
  }
}
