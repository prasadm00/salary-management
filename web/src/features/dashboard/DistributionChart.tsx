import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getDistribution, type AnalyticsFilters } from '@/api/analytics';
import { QueryState } from '@/components/QueryState';
import { formatMoney } from '@/lib/format';

interface DistributionChartProps {
  filters: AnalyticsFilters;
  /** The currency shown. In the US dollar view this is "USD". */
  currency: string;
}

/** A bar chart of how many people are in each salary range, for one currency. */
export function DistributionChart({ filters, currency }: DistributionChartProps) {
  // In the US dollar view the server converts everything, so no currency is sent.
  const sentCurrency = filters.view === 'usd' ? undefined : currency;
  const distribution = useQuery({
    queryKey: ['analytics', 'distribution', filters, sentCurrency],
    queryFn: () => getDistribution(filters, sentCurrency),
  });

  const buckets = distribution.data?.buckets ?? [];
  const bars = buckets.map((bucket) => ({
    // A short label for the axis, such as "1.2M-2.4M". The exact range is in the table below.
    label: `${shorten(bucket.from)}-${shorten(bucket.to)}`,
    people: bucket.count,
  }));

  return (
    <section aria-labelledby="distribution-heading" className="space-y-3">
      <h3 id="distribution-heading" className="text-base font-semibold">
        Salary distribution in {currency}
      </h3>

      <QueryState
        isLoading={distribution.isPending}
        error={distribution.error}
        onRetry={() => void distribution.refetch()}
        emptyMessage={
          distribution.data && buckets.length === 0
            ? 'No salaries to show for these filters.'
            : undefined
        }
      >
        <div role="img" aria-label="Bar chart of the number of employees in each salary range">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                fontSize={12}
                label={{
                  value: `Annual salary (${currency})`,
                  position: 'insideBottom',
                  offset: -16,
                  fontSize: 12,
                }}
              />
              <YAxis allowDecimals={false} fontSize={12} width={40} />
              <Tooltip formatter={(value) => [value, 'Employees']} />
              <Bar dataKey="people" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* The same numbers as a table, for screen readers and for exact figures. */}
        <table className="sr-only">
          <caption>{`People in each salary range, in ${currency}`}</caption>
          <thead>
            <tr>
              <th>Salary range</th>
              <th>People</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.from}>
                <td>{`${formatMoney(bucket.from, currency)} to ${formatMoney(bucket.to, currency)}`}</td>
                <td>{bucket.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </QueryState>
    </section>
  );
}

/** "1200000.00" becomes "1.2M". Only used for short chart labels, never for showing a salary. */
function shorten(amount: string): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(amount),
  );
}
