import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { PAGE_SIZES } from './useEmployeeListParams';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** First, previous, next and last buttons, the page number, and how many rows to show. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const selectId = useId();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={selectId}>Rows per page</Label>
        <NativeSelect
          id={selectId}
          size="sm"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <NativeSelectOption key={size} value={size}>
              {size}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="px-2 text-sm">
          Page {page} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Last page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(lastPage)}
        >
          <ChevronsRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
