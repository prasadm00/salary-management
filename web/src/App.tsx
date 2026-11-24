import { Link, Route, Routes } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EmployeeDetailPage } from '@/features/employees/EmployeeDetailPage';
import { EmployeeFormPage } from '@/features/employees/EmployeeFormPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';

/** The address of each page. */
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<EmployeeFormPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function NotFoundPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">There is nothing at this address.</p>
      <Link to="/" className="text-primary underline underline-offset-4">
        Go to the dashboard
      </Link>
    </div>
  );
}
