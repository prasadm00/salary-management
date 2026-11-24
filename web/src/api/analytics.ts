import type {
  CurrencyView,
  DistributionResponse,
  ExtremesResponse,
  GroupedStatsResponse,
  RecentChangesResponse,
  StatsGroupBy,
  SummaryResponse,
} from '@acme/shared';
import { apiGet } from './client';

/** The filters that every dashboard question understands. */
export type AnalyticsFilters = {
  country?: string;
  department?: string;
  level?: string;
  status?: string;
  view?: CurrencyView;
};

export const getSummary = (filters: AnalyticsFilters) =>
  apiGet<SummaryResponse>('/api/analytics/summary', filters);

export const getGroupedStats = (groupBy: StatsGroupBy, filters: AnalyticsFilters) =>
  apiGet<GroupedStatsResponse>(`/api/analytics/by-${groupBy}`, filters);

export const getDistribution = (filters: AnalyticsFilters, currency: string | undefined) =>
  apiGet<DistributionResponse>('/api/analytics/distribution', { ...filters, currency });

export const getExtremes = (filters: AnalyticsFilters, currency: string | undefined) =>
  apiGet<ExtremesResponse>('/api/analytics/extremes', { ...filters, currency, limit: 5 });

export const getRecentChanges = () =>
  apiGet<RecentChangesResponse>('/api/analytics/recent-changes', { limit: 10 });
