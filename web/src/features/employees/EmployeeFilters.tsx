import { EMPLOYMENT_STATUSES, LEVELS, type FilterOptions } from '@acme/shared';
import { useEffect, useRef, useState } from 'react';
import { FilterSelect } from '@/components/FilterSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ListParams } from './useEmployeeListParams';

/** How long to wait after the last key press before searching. */
const SEARCH_DELAY_MS = 300;

interface EmployeeFiltersProps {
  params: ListParams;
  /** The choices from the server. Missing until they have loaded. */
  options: FilterOptions | undefined;
  onChange: (changes: Partial<ListParams>) => void;
  onClear: () => void;
  hasFilters: boolean;
}

/** The search box and the dropdown filters above the table. */
export function EmployeeFilters({
  params,
  options,
  onChange,
  onClear,
  hasFilters,
}: EmployeeFiltersProps) {
  return (
    <section aria-label="Search and filters" className="space-y-3">
      <SearchBox urlText={params.q} onSearch={(q) => onChange({ q })} />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Country"
          allLabel="All countries"
          value={params.country}
          options={(options?.countries ?? []).map((c) => ({ value: c.code, label: c.name }))}
          onChange={(country) => onChange({ country })}
        />
        <FilterSelect
          label="Department"
          allLabel="All departments"
          value={params.department}
          options={(options?.departments ?? []).map((name) => ({ value: name, label: name }))}
          onChange={(department) => onChange({ department })}
        />
        <FilterSelect
          label="Level"
          allLabel="All levels"
          value={params.level}
          options={LEVELS.map((level) => ({ value: level, label: level }))}
          onChange={(level) => onChange({ level })}
        />
        <FilterSelect
          label="Status"
          allLabel="All statuses"
          value={params.status}
          options={EMPLOYMENT_STATUSES.map((status) => ({
            value: status,
            label: status === 'ACTIVE' ? 'Active' : 'Inactive',
          }))}
          onChange={(status) => onChange({ status })}
        />
        <FilterSelect
          label="Currency"
          allLabel="All currencies"
          value={params.currency}
          options={(options?.currencies ?? []).map((currency) => ({
            value: currency,
            label: currency,
          }))}
          onChange={(currency) => onChange({ currency })}
        />

        {hasFilters && (
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * A search box that waits for you to stop typing, so the server is asked once and not on every key.
 *
 * The box shows what you type. After a pause, the text is put in the address bar (`urlText`).
 * If the address changes some other way (the Clear button, the Back button), the box follows it.
 */
function SearchBox({ urlText, onSearch }: { urlText: string; onSearch: (text: string) => void }) {
  const [text, setText] = useState(urlText);
  const [lastSearched, setLastSearched] = useState(urlText);
  const [previousUrlText, setPreviousUrlText] = useState(urlText);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Stop a waiting search if the box disappears.
  useEffect(() => () => clearTimeout(timer.current), []);

  // The address changed, and not because of our own search: show the new text.
  if (urlText !== previousUrlText) {
    setPreviousUrlText(urlText);
    if (urlText !== lastSearched) setText(urlText);
  }

  function handleChange(newText: string) {
    setText(newText);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLastSearched(newText);
      onSearch(newText);
    }, SEARCH_DELAY_MS);
  }

  return (
    <div className="max-w-md space-y-1.5">
      <Label htmlFor="employee-search">Search by name, email or code</Label>
      <Input
        id="employee-search"
        type="search"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  );
}
