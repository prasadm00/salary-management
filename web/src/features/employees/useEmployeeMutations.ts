import type { EmploymentStatus } from '@acme/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changeSalary, createEmployee, setEmployeeStatus, type NewEmployee } from '@/api/employees';

/**
 * After a change, everything that may show the old data is loaded again:
 * the employee, the salary history, the list, and the dashboard figures.
 */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();

  return () => {
    for (const key of ['employee', 'salary-history', 'employees', 'analytics', 'filter-options']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useChangeSalary(employeeId: number) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: (change: { amount: string; reason: string }) => changeSalary(employeeId, change),
    onSuccess: refresh,
  });
}

export function useSetStatus(employeeId: number) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: (status: EmploymentStatus) => setEmployeeStatus(employeeId, status),
    onSuccess: refresh,
  });
}

export function useCreateEmployee() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: (employee: NewEmployee) => createEmployee(employee),
    onSuccess: refresh,
  });
}
