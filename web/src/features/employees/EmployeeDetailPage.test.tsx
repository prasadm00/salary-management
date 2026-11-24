import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aChange, aPage, anEmployee } from '@/tests/fixtures';
import {
  findAccessibilityProblems,
  mockFetch,
  paramsOf,
  renderWithProviders,
  requestedUrls,
  sentJson,
} from '@/tests/testUtils';
import { EmployeeDetailPage } from './EmployeeDetailPage';

afterEach(() => vi.unstubAllGlobals());

const START = aChange({ id: 1 });
const RAISE = aChange({
  id: 2,
  oldAmount: '2000000.00',
  newAmount: '2400000.00',
  reason: 'Annual review 2025',
  changedAt: '2025-04-01T00:00:00.000Z',
});

/** A fake server that remembers changes, like the real one. */
function startFakeServer(options: { historyTotal?: number; status?: number } = {}) {
  let employee = anEmployee();
  let history = [RAISE, START];

  const fake = mockFetch((url, init) => {
    if (options.status && url.pathname === '/api/employees/1') {
      return {
        status: options.status,
        body: { error: { code: 'NOT_FOUND', message: 'Employee not found.' } },
      };
    }
    const sent = (sentJson(init) ?? {}) as Record<string, string>;

    if (url.pathname === '/api/employees/1' && init.method === undefined) return { body: employee };
    if (url.pathname === '/api/employees/1/compensation-history') {
      const total = options.historyTotal ?? history.length;
      return {
        body: aPage(history, { page: Number(url.searchParams.get('page')), pageSize: 10, total }),
      };
    }
    if (url.pathname === '/api/employees/1/compensation' && init.method === 'PATCH') {
      const amount = `${sent['amount']}.00`;
      history = [
        aChange({
          id: 3,
          oldAmount: employee.compensation.amount,
          newAmount: amount,
          reason: sent['reason'] ?? '',
          changedAt: '2026-11-01T09:00:00.000Z',
        }),
        ...history,
      ];
      employee = {
        ...employee,
        compensation: { ...employee.compensation, amount, effectiveDate: '2026-11-01' },
      };
      return { body: employee };
    }
    if (url.pathname === '/api/employees/1/status' && init.method === 'PATCH') {
      employee = {
        ...employee,
        employmentStatus: sent['status'] === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      };
      return { body: employee };
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
  });
  return fake;
}

function showPage(route = '/employees/1') {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
    </Routes>,
    route,
  );
}

describe('EmployeeDetailPage: the profile', () => {
  it('shows who the person is', async () => {
    startFakeServer();
    showPage();

    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    expect(screen.getByText(/EMP-000001/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    const profile = screen.getByRole('region', { name: 'Profile' });
    expect(within(profile).getByText('asha.rao@acme.example')).toBeInTheDocument();
    expect(within(profile).getByText('Engineering')).toBeInTheDocument();
    expect(within(profile).getByText('Senior Engineer')).toBeInTheDocument();
    expect(within(profile).getByText('L3')).toBeInTheDocument();
    expect(within(profile).getByText('India')).toBeInTheDocument();
    expect(within(profile).getByText('12 Apr 2021')).toBeInTheDocument();
  });

  it('shows the current salary with its currency and the date it started', async () => {
    startFakeServer();
    showPage();

    const salary = await screen.findByRole('region', { name: 'Current salary' });
    expect(within(salary).getByText('2,400,000.00 INR')).toBeInTheDocument();
    expect(within(salary).getByText(/per year/)).toBeInTheDocument();
    expect(within(salary).getByText(/1 Apr 2025/)).toBeInTheDocument();
  });

  it('marks someone who has left', async () => {
    mockFetch((url) =>
      url.pathname === '/api/employees/1'
        ? { body: anEmployee({ employmentStatus: 'INACTIVE' }) }
        : { body: aPage([START]) },
    );
    showPage();

    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark active' })).toBeInTheDocument();
  });

  it('has a link back to the list', async () => {
    startFakeServer();
    showPage();

    expect(await screen.findByRole('link', { name: /Back to employees/ })).toHaveAttribute(
      'href',
      '/employees',
    );
  });

  it('says plainly when the employee does not exist', async () => {
    startFakeServer({ status: 404 });
    showPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Employee not found.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to employees/ })).toBeInTheDocument();
  });
});

describe('EmployeeDetailPage: the salary history', () => {
  it('lists the changes, newest first, ending with the starting salary', async () => {
    startFakeServer();
    showPage();

    const items = within(await screen.findByRole('list', { name: 'Salary history' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('1 Apr 2025');
    expect(items[0]).toHaveTextContent('2,000,000.00 INR');
    expect(items[0]).toHaveTextContent('2,400,000.00 INR');
    expect(items[0]).toHaveTextContent('Annual review 2025');
    expect(items[1]).toHaveTextContent('Starting salary');
    expect(items[1]).toHaveTextContent('2,000,000.00 INR');
    expect(items[1]).toHaveTextContent('12 Apr 2021');
  });

  it('asks for the first page of 10 entries', async () => {
    const fake = startFakeServer();
    showPage();
    await screen.findByRole('list', { name: 'Salary history' });

    const historyCall = requestedUrls(fake).find((address) =>
      address.includes('compensation-history'),
    );
    expect(paramsOf(historyCall ?? '')).toEqual({ page: '1', pageSize: '10' });
  });

  it('has no page buttons when everything fits on one page', async () => {
    startFakeServer();
    showPage();
    await screen.findByRole('list', { name: 'Salary history' });

    expect(screen.queryByRole('button', { name: 'Older' })).not.toBeInTheDocument();
  });

  it('moves between pages of a long history', async () => {
    const fake = startFakeServer({ historyTotal: 25 });
    showPage();
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    const calls = requestedUrls(fake).filter((address) => address.includes('compensation-history'));
    expect(paramsOf(calls[calls.length - 1] ?? '').page).toBe('2');
    expect(screen.getByRole('button', { name: 'Newer' })).toBeEnabled();
  });

  it('shows a problem with the history in the history area only', async () => {
    mockFetch((url) =>
      url.pathname === '/api/employees/1'
        ? { body: anEmployee() }
        : {
            status: 500,
            body: { error: { code: 'INTERNAL_ERROR', message: 'History is unavailable.' } },
          },
    );
    showPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('History is unavailable.');
    expect(screen.getByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    expect(screen.getByText('2,400,000.00 INR')).toBeInTheDocument();
  });
});

describe('EmployeeDetailPage: updating the salary', () => {
  async function updateSalaryTo(amount: string, reason: string) {
    await userEvent.click(await screen.findByRole('button', { name: 'Update salary' }));
    await userEvent.type(screen.getByLabelText('New amount (INR)'), amount);
    await userEvent.type(screen.getByLabelText('Reason'), reason);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('opens the dialog, saves, and then shows the new salary and the new history entry', async () => {
    startFakeServer();
    showPage();

    await updateSalaryTo('2500000', 'Promotion to L4');

    expect(await screen.findByText('Salary updated.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const salary = screen.getByRole('region', { name: 'Current salary' });
    await waitFor(() => expect(within(salary).getByText('2,500,000.00 INR')).toBeInTheDocument());
    // The new entry is at the top of the history.
    const history = screen.getByRole('list', { name: 'Salary history' });
    expect(await within(history).findByText('Promotion to L4')).toBeInTheDocument();
    expect(within(history).getAllByRole('listitem')).toHaveLength(3);
  });

  it('starts with an empty form each time the dialog is opened', async () => {
    startFakeServer();
    showPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Update salary' }));
    await userEvent.type(screen.getByLabelText('New amount (INR)'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Update salary' }));

    expect(screen.getByLabelText('New amount (INR)')).toHaveValue('');
  });
});

describe('EmployeeDetailPage: leaving and returning', () => {
  it('marks the person inactive, and can undo it', async () => {
    startFakeServer();
    showPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Mark inactive' }));

    expect(await screen.findByText('Marked as inactive.')).toBeInTheDocument();
    expect(await screen.findByText('Inactive')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark active' }));

    expect(await screen.findByText('Marked as active.')).toBeInTheDocument();
    expect(await screen.findByText('Active')).toBeInTheDocument();
  });

  it('sends the status change to the server', async () => {
    const fake = startFakeServer();
    showPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Mark inactive' }));

    await waitFor(() => expect(requestedUrls(fake)).toContain('/api/employees/1/status'));
    const call = fake.mock.calls.find(([address]) => address === '/api/employees/1/status');
    expect(call?.[1]?.method).toBe('PATCH');
    expect(sentJson(call?.[1])).toEqual({ status: 'INACTIVE' });
  });

  it('shows an error when the change fails, and keeps the old status', async () => {
    mockFetch((url, init) => {
      if (init.method === 'PATCH')
        return {
          status: 500,
          body: { error: { code: 'INTERNAL_ERROR', message: 'Could not change the status.' } },
        };
      if (url.pathname === '/api/employees/1') return { body: anEmployee() };
      return { body: aPage([START]) };
    });
    showPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Mark inactive' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the status.');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Marked as inactive.')).not.toBeInTheDocument();
  });
});

describe('EmployeeDetailPage: accessibility', () => {
  it('has no accessibility problems', async () => {
    startFakeServer();
    showPage();
    await screen.findByRole('list', { name: 'Salary history' });

    expect(await findAccessibilityProblems()).toEqual([]);
  });

  it('has no accessibility problems with the salary dialog open and showing errors', async () => {
    startFakeServer();
    showPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Update salary' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Enter an amount.');

    expect(await findAccessibilityProblems()).toEqual([]);
  });
});
