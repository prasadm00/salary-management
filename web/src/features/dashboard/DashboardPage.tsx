import type { SummaryResponse } from '@acme/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getSummary, type AnalyticsFilters } from '@/api/analytics';
import { getFilterOptions } from '@/api/meta';
import { QueryState } from '@/components/QueryState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { DashboardFilters } from './DashboardFilters';
import { DistributionChart } from './DistributionChart';
import { ExtremesLists } from './ExtremesLists';
import { HeadcountCards } from './HeadcountCards';
import { RecentChanges } from './RecentChanges';
import { StatsTabs } from './StatsTabs';
import { toAnalyticsFilters, useDashboardFilters } from './useDashboardFilters';

/** How the organisation pays people: headcount, statistics, the spread of salaries, and recent changes. */
export function DashboardPage() {
  const { filters, update, clear, isFiltered } = useDashboardFilters();
  const analyticsFilters = toAnalyticsFilters(filters);

  const options = useQuery({ queryKey: ['filter-options'], queryFn: getFilterOptions });
  const summary = useQuery({
    queryKey: ['analytics', 'summary', analyticsFilters],
    queryFn: () => getSummary(analyticsFilters),
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <DashboardFilters
        filters={filters}
        options={options.data}
        onChange={update}
        onClear={clear}
        isFiltered={isFiltered}
      />

      {summary.data?.view === 'usd' && (
        <Alert>
          <AlertDescription>
            All amounts are converted to US dollars using fixed, illustrative exchange rates as of{' '}
            {summary.data.ratesAsOf}. They are approximate and are not live market prices.
          </AlertDescription>
        </Alert>
      )}

      <QueryState
        isLoading={summary.isPending}
        error={summary.error}
        onRetry={() => void summary.refetch()}
        emptyMessage={
          summary.data && summary.data.headcount === 0
            ? 'No employees match these filters.'
            : undefined
        }
      >
        {summary.data && (
          <div className="space-y-8">
            <HeadcountCards summary={summary.data} />
            <StatsTabs summary={summary.data} filters={analyticsFilters} />
            <PayInOneCurrency summary={summary.data} filters={analyticsFilters} />
          </div>
        )}
      </QueryState>

      <RecentChanges />
    </div>
  );
}

/**
 * The salary spread and the highest and lowest paid, for one currency.
 * Rupees and dollars cannot share a chart, so the user picks the currency.
 */
function PayInOneCurrency({
  summary,
  filters,
}: {
  summary: SummaryResponse;
  filters: AnalyticsFilters;
}) {
  const [chosen, setChosen] = useState<string>();
  const inUsd = summary.view === 'usd';

  const currencies = summary.groups.map((group) => group.currency);
  const biggestGroup = [...summary.groups].sort((a, b) => b.headcount - a.headcount)[0];
  // Use the chosen currency if it still has people. Otherwise start with the biggest group.
  const currency =
    chosen && currencies.includes(chosen) ? chosen : (biggestGroup?.currency ?? 'USD');

  return (
    <section aria-labelledby="one-currency-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="one-currency-heading" className="text-lg font-semibold">
          {inUsd ? 'Pay in US dollars' : 'Pay within one currency'}
        </h2>
        {!inUsd && (
          <div className="space-y-1.5">
            <Label htmlFor="currency-choice">Currency</Label>
            <NativeSelect
              id="currency-choice"
              value={currency}
              onChange={(event) => setChosen(event.target.value)}
            >
              {currencies.map((code) => (
                <NativeSelectOption key={code} value={code}>
                  {code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <DistributionChart filters={filters} currency={currency} />
      <ExtremesLists filters={filters} currency={currency} />
    </section>
  );
}
