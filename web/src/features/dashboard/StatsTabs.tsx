import type { CurrencyStats, StatsGroupBy, SummaryResponse } from '@acme/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getGroupedStats, type AnalyticsFilters } from '@/api/analytics';
import { MoneyText } from '@/components/MoneyText';
import { QueryState } from '@/components/QueryState';
import { ScrollableTable } from '@/components/ScrollableTable';
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { countryName } from '@/lib/format';

type Tab = 'overall' | StatsGroupBy;

interface StatsTabsProps {
  summary: SummaryResponse;
  filters: AnalyticsFilters;
}

/** Salary statistics, shown overall or grouped by country, department or level. */
export function StatsTabs({ summary, filters }: StatsTabsProps) {
  const [tab, setTab] = useState<Tab>('overall');

  return (
    <section aria-labelledby="stats-heading" className="space-y-3">
      <h2 id="stats-heading" className="text-lg font-semibold">
        Salary statistics
      </h2>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="overall">Overall</TabsTrigger>
          <TabsTrigger value="country">By country</TabsTrigger>
          <TabsTrigger value="department">By department</TabsTrigger>
          <TabsTrigger value="level">By level</TabsTrigger>
        </TabsList>

        <TabsContent value="overall">
          <StatsTable caption="Salary statistics" rows={summary.groups} />
        </TabsContent>
        {/* A tab only asks the server for its numbers when it is opened. */}
        <TabsContent value="country">
          <GroupedStats groupBy="country" filters={filters} />
        </TabsContent>
        <TabsContent value="department">
          <GroupedStats groupBy="department" filters={filters} />
        </TabsContent>
        <TabsContent value="level">
          <GroupedStats groupBy="level" filters={filters} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function GroupedStats({ groupBy, filters }: { groupBy: StatsGroupBy; filters: AnalyticsFilters }) {
  const grouped = useQuery({
    queryKey: ['analytics', 'grouped', groupBy, filters],
    queryFn: () => getGroupedStats(groupBy, filters),
  });
  const firstColumn = { country: 'Country', department: 'Department', level: 'Level' }[groupBy];

  return (
    <QueryState
      isLoading={grouped.isPending}
      error={grouped.error}
      onRetry={() => void grouped.refetch()}
      emptyMessage={
        grouped.data && grouped.data.rows.length === 0
          ? 'No employees match these filters.'
          : undefined
      }
    >
      {grouped.data && (
        <StatsTable
          caption={`Salary statistics by ${groupBy}`}
          groupLabel={firstColumn}
          rows={grouped.data.rows.map((row) => ({
            ...row,
            // Show "India" instead of "IN".
            group: groupBy === 'country' ? countryName(row.key) : row.key,
          }))}
        />
      )}
    </QueryState>
  );
}

type Row = CurrencyStats & { group?: string };

/** One row per group and currency. Every amount is shown with its currency. */
function StatsTable({
  caption,
  groupLabel,
  rows,
}: {
  caption: string;
  groupLabel?: string;
  rows: Row[];
}) {
  return (
    <ScrollableTable label={`${caption} (scrolls sideways on a small screen)`}>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {groupLabel && <TableHead>{groupLabel}</TableHead>}
          <TableHead>Currency</TableHead>
          <TableHead className="text-right">People</TableHead>
          <TableHead className="text-right">Min</TableHead>
          <TableHead className="text-right">Median</TableHead>
          <TableHead className="text-right">Average</TableHead>
          <TableHead className="text-right">Max</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.group ?? ''}-${row.currency}`}>
            {groupLabel && <TableCell className="font-medium">{row.group}</TableCell>}
            <TableCell>{row.currency}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.headcount.toLocaleString('en-US')}
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={row.min} currency={row.currency} />
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={row.median} currency={row.currency} />
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={row.average} currency={row.currency} />
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={row.max} currency={row.currency} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ScrollableTable>
  );
}
