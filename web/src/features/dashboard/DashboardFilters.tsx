import { LEVELS, type FilterOptions } from '@acme/shared';
import { FilterSelect } from '@/components/FilterSelect';
import { Button } from '@/components/ui/button';
import type { DashboardFilters as Filters, StatusFilter } from './useDashboardFilters';

interface DashboardFiltersProps {
  filters: Filters;
  /** The choices from the server. Missing until they have loaded. */
  options: FilterOptions | undefined;
  onChange: (changes: Partial<Filters>) => void;
  onClear: () => void;
  isFiltered: boolean;
}

/** The filters at the top of the dashboard, and the choice between currencies and US dollars. */
export function DashboardFilters({
  filters,
  options,
  onChange,
  onClear,
  isFiltered,
}: DashboardFiltersProps) {
  return (
    <section aria-label="Filters" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Country"
          allLabel="All countries"
          value={filters.country}
          options={(options?.countries ?? []).map((c) => ({ value: c.code, label: c.name }))}
          onChange={(country) => onChange({ country })}
        />
        <FilterSelect
          label="Department"
          allLabel="All departments"
          value={filters.department}
          options={(options?.departments ?? []).map((name) => ({ value: name, label: name }))}
          onChange={(department) => onChange({ department })}
        />
        <FilterSelect
          label="Level"
          allLabel="All levels"
          value={filters.level}
          options={LEVELS.map((level) => ({ value: level, label: level }))}
          onChange={(level) => onChange({ level })}
        />
        {/* The empty choice means "Active only", which is the default. */}
        <FilterSelect
          label="Employees"
          allLabel="Active only"
          value={filters.status === 'ACTIVE' ? '' : filters.status}
          options={[
            { value: 'INACTIVE', label: 'Inactive only' },
            { value: 'ALL', label: 'Active and inactive' },
          ]}
          onChange={(status) => onChange({ status: (status || 'ACTIVE') as StatusFilter })}
        />
        {isFiltered && (
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <legend className="mb-1 text-sm font-medium">Show amounts in</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="view"
            checked={filters.view === 'local'}
            onChange={() => onChange({ view: 'local' })}
          />
          Each country's own currency
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="view"
            checked={filters.view === 'usd'}
            onChange={() => onChange({ view: 'usd' })}
          />
          US dollars (approximate)
        </label>
      </fieldset>
    </section>
  );
}
