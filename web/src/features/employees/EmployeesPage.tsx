import { USD_RATES_AS_OF, type EmployeeSortColumn } from '@acme/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listEmployees } from '@/api/employees';
import { getFilterOptions } from '@/api/meta';
import { QueryState } from '@/components/QueryState';
import { EmployeeFilters } from './EmployeeFilters';
import { EmployeesTable } from './EmployeesTable';
import { Pagination } from './Pagination';
import { toApiParams, useEmployeeListParams } from './useEmployeeListParams';

/** The employee directory: search, filter, sort and page through everyone. */
export function EmployeesPage() {
  const { params, update, clearFilters, hasFilters } = useEmployeeListParams();

  const apiParams = toApiParams(params);
  const list = useQuery({
    queryKey: ['employees', apiParams],
    queryFn: () => listEmployees(apiParams),
    // While the next page loads, keep showing the current one instead of a blank table.
    placeholderData: keepPreviousData,
  });
  const options = useQuery({ queryKey: ['filter-options'], queryFn: getFilterOptions });

  const total = list.data?.total ?? 0;
  const sortedInDollars = apiParams.view === 'usd';

  /** Clicking a heading sorts by it. Clicking it again reverses the order. */
  function handleSort(column: EmployeeSortColumn) {
    const reverse = column === params.sortBy && params.sortDir === 'asc';
    update({ sortBy: column, sortDir: reverse ? 'desc' : 'asc' });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Employees</h1>
        {list.data && (
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString('en-US')} {total === 1 ? 'employee' : 'employees'}
          </p>
        )}
      </div>

      <EmployeeFilters
        params={params}
        options={options.data}
        onChange={update}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      <QueryState
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyMessage={list.data && total === 0 ? 'No employees match your filters.' : undefined}
      >
        {list.data && (
          <div className="space-y-4">
            <EmployeesTable
              employees={list.data.data}
              sortBy={params.sortBy}
              sortDir={params.sortDir}
              onSort={handleSort}
            />
            {sortedInDollars && (
              <p className="text-sm text-muted-foreground">
                Sorted by salary in US dollars, using fixed, illustrative exchange rates as of{' '}
                {USD_RATES_AS_OF}. Choose a currency to compare the amounts directly.
              </p>
            )}
            <Pagination
              page={params.page}
              pageSize={params.pageSize}
              total={total}
              onPageChange={(page) => update({ page })}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
}
