import type { Employee } from '@acme/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { getEmployee } from '@/api/employees';
import { MoneyText } from '@/components/MoneyText';
import { QueryState } from '@/components/QueryState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { countryName, formatDate } from '@/lib/format';
import { EditSalaryDialog } from './EditSalaryDialog';
import { SalaryHistory } from './SalaryHistory';
import { useSetStatus } from './useEmployeeMutations';

/** One employee: their details, current salary, and salary history. */
export function EmployeeDetailPage() {
  const id = Number(useParams().id);
  const employee = useQuery({ queryKey: ['employee', id], queryFn: () => getEmployee(id) });
  // Trying again cannot help when the employee does not exist.
  const notFound = employee.error instanceof ApiError && employee.error.status === 404;

  return (
    <div className="space-y-6">
      <Link
        to="/employees"
        className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to employees
      </Link>

      <QueryState
        isLoading={employee.isPending}
        error={employee.error}
        onRetry={notFound ? undefined : () => void employee.refetch()}
      >
        {employee.data && <EmployeeDetails employee={employee.data} />}
      </QueryState>
    </div>
  );
}

function EmployeeDetails({ employee }: { employee: Employee }) {
  const [editing, setEditing] = useState(false);
  // A short message that confirms the last change.
  const [notice, setNotice] = useState<string>();
  const [statusError, setStatusError] = useState<string>();
  const setStatus = useSetStatus(employee.id);

  const isActive = employee.employmentStatus === 'ACTIVE';
  const { amount, currency, effectiveDate } = employee.compensation;

  function toggleStatus() {
    const next = isActive ? 'INACTIVE' : 'ACTIVE';
    setNotice(undefined);
    setStatusError(undefined);
    setStatus.mutate(next, {
      onSuccess: () => setNotice(next === 'INACTIVE' ? 'Marked as inactive.' : 'Marked as active.'),
      onError: (error) =>
        setStatusError(error instanceof ApiError ? error.message : 'Something went wrong.'),
    });
  }

  return (
    <>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {employee.employeeCode} · {employee.jobTitle}
        </p>
      </header>

      {notice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {statusError && (
        <Alert variant="destructive">
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="salary-heading" className="space-y-3 rounded-lg border p-4">
          <h2 id="salary-heading" className="text-lg font-semibold">
            Current salary
          </h2>
          <p className="text-3xl font-semibold">
            <MoneyText amount={amount} currency={currency} />
          </p>
          <p className="text-sm text-muted-foreground">
            per year, since {formatDate(effectiveDate)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>Update salary</Button>
            <Button variant="outline" disabled={setStatus.isPending} onClick={toggleStatus}>
              {isActive ? 'Mark inactive' : 'Mark active'}
            </Button>
          </div>
        </section>

        <section aria-labelledby="profile-heading" className="space-y-3 rounded-lg border p-4">
          <h2 id="profile-heading" className="text-lg font-semibold">
            Profile
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <Detail label="Email">{employee.email}</Detail>
            <Detail label="Department">{employee.department}</Detail>
            <Detail label="Job title">{employee.jobTitle}</Detail>
            <Detail label="Level">{employee.level}</Detail>
            <Detail label="Country">{countryName(employee.country)}</Detail>
            <Detail label="Hired">{formatDate(employee.hireDate)}</Detail>
          </dl>
        </section>
      </div>

      <SalaryHistory employeeId={employee.id} />

      <EditSalaryDialog
        employee={employee}
        open={editing}
        onOpenChange={setEditing}
        onSaved={() => {
          setStatusError(undefined);
          setNotice('Salary updated.');
        }}
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
