import type { Employee, EmployeeSortColumn, SortDirection } from '@acme/shared';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Link } from 'react-router';
import { MoneyText } from '@/components/MoneyText';
import { ScrollableTable } from '@/components/ScrollableTable';
import { Badge } from '@/components/ui/badge';
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { countryName, formatDate } from '@/lib/format';

// On a phone there is no room for every column, so the less important ones are hidden.
const HIDE_ON_PHONE = 'hidden md:table-cell';

const COLUMNS: { column: EmployeeSortColumn; label: string; hideOnPhone?: boolean }[] = [
  { column: 'employeeCode', label: 'Code', hideOnPhone: true },
  { column: 'fullName', label: 'Name' },
  { column: 'department', label: 'Department', hideOnPhone: true },
  { column: 'level', label: 'Level', hideOnPhone: true },
  { column: 'country', label: 'Country', hideOnPhone: true },
  { column: 'hireDate', label: 'Hired', hideOnPhone: true },
  { column: 'salary', label: 'Salary' },
];

interface EmployeesTableProps {
  employees: Employee[];
  sortBy: EmployeeSortColumn;
  sortDir: SortDirection;
  onSort: (column: EmployeeSortColumn) => void;
}

/** The list of employees. Clicking a column heading sorts by that column. */
export function EmployeesTable({ employees, sortBy, sortDir, onSort }: EmployeesTableProps) {
  return (
    <ScrollableTable label="Employees table">
      <TableCaption className="sr-only">Employees</TableCaption>
      <TableHeader>
        <TableRow>
          {COLUMNS.map(({ column, label, hideOnPhone }) => (
            <TableHead
              key={column}
              aria-sort={ariaSort(column, sortBy, sortDir)}
              className={hideOnPhone ? HIDE_ON_PHONE : undefined}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSort(column)}
              >
                {label}
                <SortIcon active={column === sortBy} direction={sortDir} />
              </button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
              There are no employees on this page.
            </TableCell>
          </TableRow>
        )}
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell className={`tabular-nums ${HIDE_ON_PHONE}`}>
              {employee.employeeCode}
            </TableCell>
            <TableCell>
              <Link
                to={`/employees/${employee.id}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {employee.fullName}
              </Link>
              {employee.employmentStatus === 'INACTIVE' && (
                <Badge variant="secondary" className="ml-2">
                  Inactive
                </Badge>
              )}
              {/* On a phone the Department column is hidden, so it is shown under the name. */}
              <span className="block text-xs text-muted-foreground md:hidden">
                {employee.department}
              </span>
            </TableCell>
            <TableCell className={HIDE_ON_PHONE}>{employee.department}</TableCell>
            <TableCell className={HIDE_ON_PHONE}>{employee.level}</TableCell>
            <TableCell className={HIDE_ON_PHONE}>{countryName(employee.country)}</TableCell>
            <TableCell className={`whitespace-nowrap ${HIDE_ON_PHONE}`}>
              {formatDate(employee.hireDate)}
            </TableCell>
            <TableCell>
              <MoneyText
                amount={employee.compensation.amount}
                currency={employee.compensation.currency}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ScrollableTable>
  );
}

/** What a screen reader says about a column's sort state. */
function ariaSort(column: EmployeeSortColumn, sortBy: EmployeeSortColumn, sortDir: SortDirection) {
  if (column !== sortBy) return 'none';
  return sortDir === 'asc' ? 'ascending' : 'descending';
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active)
    return <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />;
  return direction === 'asc' ? (
    <ArrowUp className="size-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden="true" />
  );
}
