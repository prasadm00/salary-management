import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getRecentChanges } from '@/api/analytics';
import { MoneyText } from '@/components/MoneyText';
import { QueryState } from '@/components/QueryState';
import { formatDate } from '@/lib/format';

/** The latest salary changes, newest first. It does not depend on the filters. */
export function RecentChanges() {
  const recent = useQuery({ queryKey: ['analytics', 'recent-changes'], queryFn: getRecentChanges });

  return (
    <section aria-labelledby="recent-heading" className="space-y-3">
      <h2 id="recent-heading" className="text-lg font-semibold">
        Recent salary changes
      </h2>
      <p className="text-sm text-muted-foreground">
        Always shown in each person's own currency. The filters above do not apply here.
      </p>

      <QueryState
        isLoading={recent.isPending}
        error={recent.error}
        onRetry={() => void recent.refetch()}
        emptyMessage={
          recent.data && recent.data.data.length === 0 ? 'No salary changes yet.' : undefined
        }
      >
        {recent.data && (
          <ol aria-label="Recent salary changes" className="divide-y rounded-lg border">
            {recent.data.data.map((change) => (
              <li key={change.id} className="space-y-0.5 px-3 py-2">
                <p>
                  <Link
                    to={`/employees/${change.employee.id}`}
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    {change.employee.fullName}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    <MoneyText amount={change.oldAmount} currency={change.currency} /> →{' '}
                    <MoneyText amount={change.newAmount} currency={change.currency} />
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {change.reason} · {formatDate(change.changedAt.slice(0, 10))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </QueryState>
    </section>
  );
}
