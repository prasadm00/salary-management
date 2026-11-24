import type {
  CompensationChange,
  CurrencyView,
  Employee,
  EmployeeSortColumn,
  EmploymentStatus,
  Paged,
  SortDirection,
} from '@acme/shared';
import { apiGet, apiSend } from './client';

// Each function below is one call to the API. The types come from the shared package,
// so the web app and the API always agree on the shape of the data.

export type EmployeeListParams = {
  q?: string;
  country?: string;
  department?: string;
  level?: string;
  status?: string;
  currency?: string;
  sortBy?: EmployeeSortColumn;
  sortDir?: SortDirection;
  view?: CurrencyView;
  page?: number;
  pageSize?: number;
};

export const listEmployees = (params: EmployeeListParams) =>
  apiGet<Paged<Employee>>('/api/employees', params);

export const getEmployee = (id: number) => apiGet<Employee>(`/api/employees/${id}`);

export interface NewEmployee {
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  level: string;
  country: string;
  hireDate: string;
  salary: string;
}

export const createEmployee = (employee: NewEmployee) =>
  apiSend<Employee>('POST', '/api/employees', employee);

export const changeSalary = (id: number, change: { amount: string; reason: string }) =>
  apiSend<Employee>('PATCH', `/api/employees/${id}/compensation`, change);

export const setEmployeeStatus = (id: number, status: EmploymentStatus) =>
  apiSend<Employee>('PATCH', `/api/employees/${id}/status`, { status });

export const getSalaryHistory = (id: number, page: number) =>
  apiGet<Paged<CompensationChange>>(`/api/employees/${id}/compensation-history`, {
    page,
    pageSize: 10,
  });
