import type { CurrencyView } from '@acme/shared';
import { useSearchParams } from 'react-router';
import type { AnalyticsFilters } from '@/api/analytics';

export type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

/** What the user chose on the dashboard. It lives in the address bar, so a link can be shared. */
export interface DashboardFilters {
  country: string;
  department: string;
  level: string;
  status: StatusFilter;
  view: CurrencyView;
}

const DEFAULTS: DashboardFilters = {
  country: '',
  department: '',
  level: '',
  status: 'ACTIVE',
  view: 'local',
};

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status');
  const filters: DashboardFilters = {
    country: searchParams.get('country') ?? '',
    department: searchParams.get('department') ?? '',
    level: searchParams.get('level') ?? '',
    status: status === 'INACTIVE' || status === 'ALL' ? status : 'ACTIVE',
    view: searchParams.get('view') === 'usd' ? 'usd' : 'local',
  };

  /** Changes some choices. A choice equal to its default is left out of the address. */
  function update(changes: Partial<DashboardFilters>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value === DEFAULTS[name as keyof DashboardFilters]) next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next);
  }

  function clear() {
    setSearchParams(new URLSearchParams());
  }

  const isFiltered = (Object.keys(DEFAULTS) as (keyof DashboardFilters)[]).some(
    (name) => filters[name] !== DEFAULTS[name],
  );

  return { filters, update, clear, isFiltered };
}

/** What to ask the server. Empty choices are dropped by the API client. */
export function toAnalyticsFilters(filters: DashboardFilters): AnalyticsFilters {
  return { ...filters };
}
