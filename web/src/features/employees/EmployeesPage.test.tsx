import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTER_OPTIONS, aPage, anEmployee } from '@/tests/fixtures';
import {
  findAccessibilityProblems,
  mockFetch,
  paramsOf,
  renderWithProviders,
  requestedUrls,
  type FakeReply,
} from '@/tests/testUtils';
import { EmployeesPage } from './EmployeesPage';

const ASHA = anEmployee();
const LIAM = anEmployee({
  id: 2,
  employeeCode: 'EMP-000002',
  fullName: 'Liam Carter',
  department: 'Sales',
  level: 'L4',
  country: 'US',
  hireDate: '2019-09-02',
  compensation: { amount: '95000.00', currency: 'USD', effectiveDate: '2024-01-15' },
});
const MIA = anEmployee({
  id: 3,
  employeeCode: 'EMP-000003',
  fullName: 'Mia Lopez',
  employmentStatus: 'INACTIVE',
});

/** A fake server with 10,000 employees. `employeesReply` can be changed by a test. */
function startFakeServer(employeesReply?: (url: URL) => FakeReply) {
  return mockFetch((url) => {
    if (url.pathname === '/api/meta/filters') return { body: FILTER_OPTIONS };
    if (url.pathname === '/api/employees') {
      return employeesReply?.(url) ?? { body: aPage([ASHA, LIAM, MIA], { total: 10000 }) };
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
  });
}

/** The parameters of the most recent request for the employee list. */
function lastListParams(fake: ReturnType<typeof mockFetch>) {
  const lists = requestedUrls(fake).filter((address) => address.startsWith('/api/employees'));
  return paramsOf(lists[lists.length - 1] ?? '');
}

const DEFAULTS = { page: '1', pageSize: '25', sortBy: 'fullName', sortDir: 'asc' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('EmployeesPage: the table', () => {
  it('shows each employee with their code, department, level, country, hire date and salary', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    const row = (await screen.findByRole('link', { name: 'Liam Carter' })).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('EMP-000002')).toBeInTheDocument();
    // The department is in its own column, and also under the name (shown on phones only).
    expect(cells.getAllByText('Sales')).toHaveLength(2);
    expect(cells.getByText('L4')).toBeInTheDocument();
    expect(cells.getByText('United States')).toBeInTheDocument();
    expect(cells.getByText('2 Sep 2019')).toBeInTheDocument();
    expect(cells.getByText('95,000.00 USD')).toBeInTheDocument();
  });

  it('links each name to the employee page', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/employees/1',
    );
  });

  it('labels people who have left', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    const row = (await screen.findByRole('link', { name: 'Mia Lopez' })).closest(
      'tr',
    ) as HTMLElement;

    expect(within(row).getByText('Inactive')).toBeInTheDocument();
    expect(
      within(
        (await screen.findByRole('link', { name: 'Asha Rao' })).closest('tr') as HTMLElement,
      ).queryByText('Inactive'),
    ).toBeNull();
  });

  it('shows the total number of matching employees', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText('10,000 employees')).toBeInTheDocument();
  });

  it('says "1 employee" for one match', async () => {
    startFakeServer(() => ({ body: aPage([ASHA]) }));
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText('1 employee')).toBeInTheDocument();
  });

  it('shows a loading message first', () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});

describe('EmployeesPage: what it asks the server for', () => {
  it('asks for the first page of 25, sorted by name, with no filters', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(lastListParams(fake)).toEqual(DEFAULTS);
  });

  it.each([
    ['Country', 'IN', 'country'],
    ['Department', 'Sales', 'department'],
    ['Level', 'L3', 'level'],
    ['Status', 'INACTIVE', 'status'],
    ['Currency', 'USD', 'currency'],
  ])('choosing %s asks the server for that filter', async (label, value, param) => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.selectOptions(screen.getByLabelText(label), value);

    await waitFor(() => expect(lastListParams(fake)).toEqual({ ...DEFAULTS, [param]: value }));
  });

  it('combines several filters', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IN');
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Engineering');
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'L3');

    await waitFor(() =>
      expect(lastListParams(fake)).toEqual({
        ...DEFAULTS,
        country: 'IN',
        department: 'Engineering',
        level: 'L3',
      }),
    );
  });

  it('goes back to page 1 when a filter changes', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?page=3');
    await screen.findByRole('link', { name: 'Asha Rao' });
    expect(lastListParams(fake).page).toBe('3');

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'US');

    await waitFor(() => expect(lastListParams(fake)).toMatchObject({ country: 'US', page: '1' }));
  });

  it('choosing "All" again removes the filter', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?country=IN');
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'All countries');

    await waitFor(() => expect(lastListParams(fake)).toEqual(DEFAULTS));
  });

  it('offers the choices that the server lists', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    const country = screen.getByLabelText('Country');
    await waitFor(() =>
      expect(within(country).getByRole('option', { name: 'India' })).toBeInTheDocument(),
    );
    expect(within(country).getByRole('option', { name: 'All countries' })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Department'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All departments', 'Engineering', 'Sales']);
    expect(within(screen.getByLabelText('Level')).getAllByRole('option')).toHaveLength(7);
  });
});

describe('EmployeesPage: the address bar', () => {
  it('reads filters, sort and page from the address, so a link can be shared', async () => {
    const fake = startFakeServer();
    renderWithProviders(
      <EmployeesPage />,
      '/employees?country=IN&level=L3&sortBy=hireDate&sortDir=desc&page=2&pageSize=50&q=asha',
    );
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(lastListParams(fake)).toEqual({
      country: 'IN',
      level: 'L3',
      sortBy: 'hireDate',
      sortDir: 'desc',
      page: '2',
      pageSize: '50',
      q: 'asha',
    });
    expect(screen.getByLabelText('Country')).toHaveValue('IN');
    expect(screen.getByLabelText('Level')).toHaveValue('L3');
    expect(screen.getByLabelText('Rows per page')).toHaveValue('50');
    expect(screen.getByLabelText('Search by name, email or code')).toHaveValue('asha');
  });

  it('ignores values in the address that make no sense, instead of failing', async () => {
    const fake = startFakeServer();
    renderWithProviders(
      <EmployeesPage />,
      '/employees?sortBy=hack&sortDir=sideways&page=abc&pageSize=7',
    );
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(lastListParams(fake)).toEqual(DEFAULTS);
  });
});

describe('EmployeesPage: search', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  const typeInSearchBox = (text: string) =>
    userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .type(screen.getByLabelText('Search by name, email or code'), text);

  it('waits until typing stops, then asks once', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });
    const callsBefore = fake.mock.calls.length;

    await typeInSearchBox('priya');
    expect(fake.mock.calls.length).toBe(callsBefore); // nothing yet

    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(lastListParams(fake)).toEqual({ ...DEFAULTS, q: 'priya' }));
    expect(fake.mock.calls.length).toBe(callsBefore + 1); // one request, not five
  });

  it('goes back to page 1 when the search text changes', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?page=4');
    await screen.findByRole('link', { name: 'Asha Rao' });

    await typeInSearchBox('li');
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(lastListParams(fake)).toMatchObject({ q: 'li', page: '1' }));
  });

  it('shows everyone again when the search box is emptied', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?q=asha');
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .clear(screen.getByLabelText('Search by name, email or code'));
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(lastListParams(fake)).toEqual(DEFAULTS));
  });
});

describe('EmployeesPage: sorting', () => {
  it('sorts by a column when its heading is clicked, and again to reverse it', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.click(screen.getByRole('button', { name: /Department/ }));
    await waitFor(() =>
      expect(lastListParams(fake)).toMatchObject({ sortBy: 'department', sortDir: 'asc' }),
    );

    await userEvent.click(screen.getByRole('button', { name: /Department/ }));
    await waitFor(() =>
      expect(lastListParams(fake)).toMatchObject({ sortBy: 'department', sortDir: 'desc' }),
    );
  });

  it('tells screen readers which column is sorted, and in which direction', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?sortBy=hireDate&sortDir=desc');
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(screen.getByRole('columnheader', { name: /Hired/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none');
  });

  it('keeps the filters when sorting', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?country=IN');
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.click(screen.getByRole('button', { name: /Hired/ }));

    await waitFor(() =>
      expect(lastListParams(fake)).toMatchObject({ country: 'IN', sortBy: 'hireDate' }),
    );
  });

  describe('sorting by salary', () => {
    it('compares in US dollars when people are paid in different currencies, and says so', async () => {
      const fake = startFakeServer();
      renderWithProviders(<EmployeesPage />);
      await screen.findByRole('link', { name: 'Asha Rao' });

      await userEvent.click(screen.getByRole('button', { name: /Salary/ }));

      await waitFor(() =>
        expect(lastListParams(fake)).toMatchObject({ sortBy: 'salary', view: 'usd' }),
      );
      expect(await screen.findByText(/sorted by salary in US dollars/i)).toHaveTextContent(
        '2026-01-01',
      );
    });

    it('compares the amounts directly when one currency is chosen, with no conversion note', async () => {
      const fake = startFakeServer();
      renderWithProviders(<EmployeesPage />, '/employees?currency=INR');
      await screen.findByRole('link', { name: 'Asha Rao' });

      await userEvent.click(screen.getByRole('button', { name: /Salary/ }));

      await waitFor(() =>
        expect(lastListParams(fake)).toMatchObject({ sortBy: 'salary', currency: 'INR' }),
      );
      expect(lastListParams(fake)).not.toHaveProperty('view');
      expect(screen.queryByText(/US dollars/i)).not.toBeInTheDocument();
    });

    it('stops asking for dollars when sorting by something else', async () => {
      const fake = startFakeServer();
      renderWithProviders(<EmployeesPage />, '/employees?sortBy=salary');
      await screen.findByRole('link', { name: 'Asha Rao' });
      expect(lastListParams(fake)).toHaveProperty('view', 'usd');

      await userEvent.click(screen.getByRole('button', { name: /Name/ }));

      await waitFor(() => expect(lastListParams(fake)).toMatchObject({ sortBy: 'fullName' }));
      expect(lastListParams(fake)).not.toHaveProperty('view');
    });
  });
});

describe('EmployeesPage: paging', () => {
  it('shows which page you are on, out of how many', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText('Page 1 of 400')).toBeInTheDocument();
  });

  it('cannot go back from the first page', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('goes to the next, previous, first and last pages', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?page=5');
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastListParams(fake).page).toBe('6'));

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(lastListParams(fake).page).toBe('5'));

    await userEvent.click(screen.getByRole('button', { name: 'Last page' }));
    await waitFor(() => expect(lastListParams(fake).page).toBe('400'));

    await userEvent.click(screen.getByRole('button', { name: 'First page' }));
    await waitFor(() => expect(lastListParams(fake).page).toBe('1'));
  });

  it('cannot go forward from the last page', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?page=400');
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled();
  });

  it('changes how many rows are shown, and goes back to page 1', async () => {
    const fake = startFakeServer();
    renderWithProviders(<EmployeesPage />, '/employees?page=3');
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '100');

    await waitFor(() => expect(lastListParams(fake)).toMatchObject({ pageSize: '100', page: '1' }));
    expect(await screen.findByText('Page 1 of 100')).toBeInTheDocument();
  });
});

describe('EmployeesPage: clearing filters', () => {
  it('has no "Clear filters" button when nothing is filtered', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('removes every filter and the search text with one click, but keeps the sort', async () => {
    const fake = startFakeServer();
    renderWithProviders(
      <EmployeesPage />,
      '/employees?country=IN&level=L3&q=asha&sortBy=hireDate&page=2',
    );
    await screen.findByRole('link', { name: 'Asha Rao' });

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(lastListParams(fake)).toEqual({ ...DEFAULTS, sortBy: 'hireDate' }));
    expect(screen.getByLabelText('Country')).toHaveValue('');
    expect(screen.getByLabelText('Search by name, email or code')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('EmployeesPage: when something is wrong', () => {
  it('explains that nobody matches, and offers a way out', async () => {
    startFakeServer(() => ({ body: aPage([], { total: 0 }) }));
    renderWithProviders(<EmployeesPage />, '/employees?country=IN');

    expect(await screen.findByText('No employees match your filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error in plain words, with a Try again button that works', async () => {
    let failing = true;
    const fake = startFakeServer(() =>
      failing
        ? {
            status: 500,
            body: {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Something went wrong. Please try again.',
                requestId: 'req-9',
              },
            },
          }
        : { body: aPage([ASHA], { total: 1 }) },
    );
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('req-9');

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Asha Rao' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fake).toHaveBeenCalled();
  });

  it('still shows the filters when the list fails, so the user can change them', async () => {
    startFakeServer(() => ({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Oops' } },
    }));
    renderWithProviders(<EmployeesPage />);

    await screen.findByRole('alert');

    expect(screen.getByLabelText('Country')).toBeInTheDocument();
    expect(screen.getByLabelText('Search by name, email or code')).toBeInTheDocument();
  });

  it('still works when the filter choices cannot be loaded', async () => {
    mockFetch((url) =>
      url.pathname === '/api/employees'
        ? { body: aPage([ASHA]) }
        : { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Oops' } } },
    );
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByRole('link', { name: 'Asha Rao' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Department')).getAllByRole('option')).toHaveLength(1);
  });
});

describe('EmployeesPage: accessibility', () => {
  it('has no accessibility problems', async () => {
    startFakeServer();
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('link', { name: 'Asha Rao' });

    expect(await findAccessibilityProblems()).toEqual([]);
  });

  it('has no accessibility problems when the list has failed', async () => {
    startFakeServer(() => ({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Oops' } },
    }));
    renderWithProviders(<EmployeesPage />, '/employees?country=IN');
    await screen.findByRole('alert');

    expect(await findAccessibilityProblems()).toEqual([]);
  });
});
