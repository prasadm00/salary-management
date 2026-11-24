import type { ExtremeEmployee } from '@acme/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getExtremes, type AnalyticsFilters } from '@/api/analytics';
import { MoneyText } from '@/components/MoneyText';
import { QueryState } from '@/components/QueryState';
import { countryName } from '@/lib/format';

interface ExtremesListsProps {
  filters: AnalyticsFilters;
  /** The currency shown. In the US dollar view this is "USD". */
  currency: string;
}

/** The five highest and five lowest paid people, in one currency. */
export function ExtremesLists({ filters, currency }: ExtremesListsProps) {
  const sentCurrency = filters.view === 'usd' ? undefined : currency;
  const extremes = useQuery({
    queryKey: ['analytics', 'extremes', filters, sentCurrency],
    queryFn: () => getExtremes(filters, sentCurrency),
  });
  const nobody =
    extremes.data && extremes.data.top.length === 0 && extremes.data.bottom.length === 0;

  return (
    <QueryState
      isLoading={extremes.isPending}
      error={extremes.error}
      onRetry={() => void extremes.refetch()}
      emptyMessage={nobody ? 'No one to list for these filters.' : undefined}
    >
      {extremes.data && (
        <div className="grid gap-6 md:grid-cols-2">
          <PeopleList
            title={`Highest paid in ${currency}`}
            people={extremes.data.top}
            currency={currency}
          />
          <PeopleList
            title={`Lowest paid in ${currency}`}
            people={extremes.data.bottom}
            currency={currency}
          />
        </div>
      )}
    </QueryState>
  );
}

function PeopleList({
  title,
  people,
  currency,
}: {
  title: string;
  people: ExtremeEmployee[];
  currency: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <ol aria-label={title} className="divide-y rounded-lg border">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 px-3 py-2"
          >
            <div>
              <Link
                to={`/employees/${person.id}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {person.fullName}
              </Link>
              <p className="text-sm text-muted-foreground">
                {person.department} · {person.level} · {countryName(person.country)}
              </p>
            </div>
            <MoneyText amount={person.amount} currency={currency} />
          </li>
        ))}
      </ol>
    </section>
  );
}
