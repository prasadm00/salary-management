import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/tests/testUtils';
import { App } from './App';

// These tests are about the shell and the routes, so the pages are replaced by simple stand-ins.
vi.mock('@/features/dashboard/DashboardPage', () => ({
  DashboardPage: () => <h1>Dashboard page</h1>,
}));
vi.mock('@/features/employees/EmployeesPage', () => ({
  EmployeesPage: () => <h1>Employees page</h1>,
}));
vi.mock('@/features/employees/EmployeeDetailPage', () => ({
  EmployeeDetailPage: () => <h1>Detail page</h1>,
}));
vi.mock('@/features/employees/EmployeeFormPage', () => ({
  EmployeeFormPage: () => <h1>Add page</h1>,
}));

describe('App shell', () => {
  it('shows the app name and the three navigation links', () => {
    renderWithProviders(<App />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(screen.getByText('ACME Salary Management')).toBeInTheDocument();
    expect(nav).toHaveTextContent('Dashboard');
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/employees');
    expect(screen.getByRole('link', { name: 'Add employee' })).toHaveAttribute(
      'href',
      '/employees/new',
    );
  });

  it('has a main area and a "skip to content" link for keyboard users', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });

  it('marks the page you are on', () => {
    renderWithProviders(<App />, '/employees');

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('moves between pages when a link is clicked', async () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Employees' }));

    expect(screen.getByRole('heading', { name: 'Employees page' })).toBeInTheDocument();
  });
});

describe('routes', () => {
  it.each([
    ['/', 'Dashboard page'],
    ['/employees', 'Employees page'],
    ['/employees/new', 'Add page'],
    ['/employees/42', 'Detail page'],
  ])('%s shows the right page', (route, heading) => {
    renderWithProviders(<App />, route);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('shows a friendly page for an address that does not exist, with a way back', () => {
    renderWithProviders(<App />, '/nothing-here');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/');
  });
});
