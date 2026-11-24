import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getSalaryHistory } from '@/api/employees';
import { MoneyText } from '@/components/MoneyText';
import { QueryState } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 10;

/** Every salary an employee has had, newest first. Long histories are shown a page at a time. */
export function SalaryHistory({ employeeId }: { employeeId: number }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['salary-history', employeeId, page],
    queryFn: () => getSalaryHistory(employeeId, page),
    placeholderData: keepPreviousData,
  });

  const total = history.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section aria-labelledby="history-heading" className="space-y-3">
      <h2 id="history-heading" className="text-lg font-semibold">
        Salary history
      </h2>

      <QueryState
        isLoading={history.isPending}
        error={history.error}
        onRetry={() => void history.refetch()}
      >
        {history.data && (
          <>
            <ol aria-label="Salary history" className="space-y-3 border-l pl-4">
              {history.data.data.map((change) => (
                <li key={change.id} className="space-y-0.5">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(change.changedAt.slice(0, 10))}
                  </p>
                  {change.oldAmount === null ? (
                    <p>
                      Starting salary{' '}
                      <MoneyText amount={change.newAmount} currency={change.currency} />
                    </p>
                  ) : (
                    <p>
                      <MoneyText amount={change.oldAmount} currency={change.currency} /> →{' '}
                      <MoneyText amount={change.newAmount} currency={change.currency} />
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{change.reason}</p>
                </li>
              ))}
            </ol>

            {lastPage > 1 && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Newer
                </Button>
                <span className="text-sm">
                  Page {page} of {lastPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage(page + 1)}
                >
                  Older
                </Button>
              </div>
            )}
          </>
        )}
      </QueryState>
    </section>
  );
}
