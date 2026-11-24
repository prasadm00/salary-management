import { EMPLOYEE_SORT_COLUMNS, type EmployeeSortColumn, type SortDirection } from '@acme/shared';
import { useSearchParams } from 'react-router';
import type { EmployeeListParams } from '@/api/employees';

export const PAGE_SIZES = [25, 50, 100];

/** Everything the user can change on the list page. It lives in the address bar. */
export interface ListParams {
  q: string;
  country: string;
  department: string;
  level: string;
  status: string;
  currency: string;
  sortBy: EmployeeSortColumn;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
}

/** A value equal to its default is left out of the address, to keep it short. */
const DEFAULTS: ListParams = {
  q: '',
  country: '',
  department: '',
  level: '',
  status: '',
  currency: '',
  sortBy: 'fullName',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
};

const FILTERS = ['q', 'country', 'department', 'level', 'status', 'currency'] as const;

/**
 * Keeps the list page's choices in the address bar (for example ?country=IN&page=2).
 * That way a link can be shared, the page survives a reload, and the Back button works.
 */
export function useEmployeeListParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);

  /** Changes some choices. Anything except moving between pages goes back to page 1. */
  function update(changes: Partial<ListParams>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value === DEFAULTS[name as keyof ListParams]) next.delete(name);
      else next.set(name, String(value));
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  }

  /** Removes the search text and every filter. The sort order stays. */
  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    for (const name of [...FILTERS, 'page']) next.delete(name);
    setSearchParams(next);
  }

  const hasFilters = FILTERS.some((name) => params[name] !== '');

  return { params, update, clearFilters, hasFilters };
}

/** Reads the address bar. A value that makes no sense is replaced by its default. */
function readParams(searchParams: URLSearchParams): ListParams {
  const text = (name: string) => searchParams.get(name) ?? '';
  const pageSize = PAGE_SIZES.find((size) => String(size) === text('pageSize'));

  return {
    q: text('q'),
    country: text('country'),
    department: text('department'),
    level: text('level'),
    status: text('status'),
    currency: text('currency'),
    sortBy: EMPLOYEE_SORT_COLUMNS.find((column) => column === text('sortBy')) ?? DEFAULTS.sortBy,
    sortDir: text('sortDir') === 'desc' ? 'desc' : 'asc',
    page: /^[1-9]\d{0,6}$/.test(text('page')) ? Number(text('page')) : DEFAULTS.page,
    pageSize: pageSize ?? DEFAULTS.pageSize,
  };
}

/**
 * What to ask the server. Empty choices are dropped later by the API client.
 * Salaries in different currencies cannot be put in order by their amounts, so sorting by
 * salary without choosing one currency compares them in US dollars.
 */
export function toApiParams(params: ListParams): EmployeeListParams {
  const sortInDollars = params.sortBy === 'salary' && params.currency === '';
  return sortInDollars ? { ...params, view: 'usd' } : params;
}
