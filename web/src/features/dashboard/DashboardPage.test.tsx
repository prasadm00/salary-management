import type {
  DistributionResponse,
  ExtremesResponse,
  GroupedStatsResponse,
  RecentChangesResponse,
  SummaryResponse,
} from '@acme/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FILTER_OPTIONS } from '@/tests/fixtures';
import {
  findAccessibilityProblems,
  mockFetch,
  paramsOf,
  renderWithProviders,
  requestedUrls,
  type FakeReply,
} from '@/tests/testUtils';
import { DashboardPage } from './DashboardPage';

afterEach(() => vi.unstubAllGlobals());

const stats = (currency: string, headcount: number, base: number) => ({
  currency,
  headcount,
  min: `${base}.00`,
  max: `${base * 4}.00`,
  average: `${base * 2}.50`,
  median: `${base * 2}.00`,
  p25: `${base}.00`,
  p75: `${base * 3}.00`,
});

const SUMMARY: SummaryResponse = {
  view: 'local',
  headcount: 11,
  groups: [stats('EUR', 2, 50000), stats('INR', 6, 1200000), stats('USD', 3, 40000)],
};

const SUMMARY_USD: SummaryResponse = {
  view: 'usd',
  ratesAsOf: '2026-01-01',
  ratesNote: 'Fixed, illustrative exchange rates. Not live market data.',
  headcount: 11,
  groups: [stats('USD', 11, 20000)],
};

const BY_COUNTRY: GroupedStatsResponse = {
  view: 'local',
  groupBy: 'country',
  headcount: 11,
  rows: [
    { key: 'IN', ...stats('INR', 6, 1200000) },
    { key: 'US', ...stats('USD', 3, 40000) },
  ],
};

const BY_DEPARTMENT: GroupedStatsResponse = {
  view: 'local',
  groupBy: 'department',
  headcount: 11,
  rows: [
    { key: 'Engineering', ...stats('INR', 4, 1500000) },
    { key: 'Engineering', ...stats('USD', 2, 60000) },
  ],
};

const DISTRIBUTION: DistributionResponse = {
  view: 'local',
  currency: 'INR',
  headcount: 6,
  min: '1200000.00',
  max: '4800000.00',
  buckets: [
    { from: '1200000.00', to: '2400000.00', count: 4 },
    { from: '2400000.00', to: '3600000.00', count: 1 },
    { from: '3600000.00', to: '4800000.00', count: 1 },
  ],
};

const PERSON = {
  id: 5,
  employeeCode: 'EMP-000005',
  fullName: 'Rahul Rao',
  department: 'Engineering',
  level: 'L6',
  country: 'IN',
  amount: '4800000.00',
};

const EXTREMES: ExtremesResponse = {
  view: 'local',
  currency: 'INR',
  top: [
    PERSON,
    { ...PERSON, id: 6, employeeCode: 'EMP-000006', fullName: 'Meera Nair', amount: '3600000.00' },
  ],
  bottom: [
    {
      ...PERSON,
      id: 9,
      employeeCode: 'EMP-000009',
      fullName: 'Amit Das',
      level: 'L1',
      amount: '1200000.00',
    },
  ],
};

const RECENT: RecentChangesResponse = {
  data: [
    {
      id: 4,
      employee: { id: 1, employeeCode: 'EMP-000001', fullName: 'Asha Rao' },
      oldAmount: '2000000.00',
      newAmount: '2400000.00',
      currency: 'INR',
      reason: 'Annual review',
      changedAt: '2026-10-01T09:00:00.000Z',
    },
  ],
};

type Replies = Partial<
  Record<'summary' | 'country' | 'department' | 'distribution' | 'extremes' | 'recent', FakeReply>
>;

/** A fake server for the dashboard. A test can replace any one answer. */
function startFakeServer(replies: Replies = {}) {
  return mockFetch((url) => {
    const usd = url.searchParams.get('view') === 'usd';
    switch (url.pathname) {
      case '/api/meta/filters':
        return { body: FILTER_OPTIONS };
      case '/api/analytics/summary':
        return replies.summary ?? { body: usd ? SUMMARY_USD : SUMMARY };
      case '/api/analytics/by-country':
        return replies.country ?? { body: BY_COUNTRY };
      case '/api/analytics/by-department':
        return replies.department ?? { body: BY_DEPARTMENT };
      case '/api/analytics/by-level':
        return {
          body: {
            ...BY_COUNTRY,
            groupBy: 'level',
            rows: [{ key: 'L3', ...stats('INR', 2, 1800000) }],
          },
        };
      case '/api/analytics/distribution':
        return (
          replies.distribution ?? {
            body: { ...DISTRIBUTION, currency: url.searchParams.get('currency') ?? 'USD' },
          }
        );
      case '/api/analytics/extremes':
        return (
          replies.extremes ?? {
            body: { ...EXTREMES, currency: url.searchParams.get('currency') ?? 'USD' },
          }
        );
      case '/api/analytics/recent-changes':
        return replies.recent ?? { body: RECENT };
      default:
        return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
    }
  });
}

/** The parameters of the most recent request to one analytics address. */
function lastParams(fake: ReturnType<typeof mockFetch>, path: string) {
  const calls = requestedUrls(fake).filter((address) => address.startsWith(path));
  return paramsOf(calls[calls.length - 1] ?? '');
}

const failure = (message: string): FakeReply => ({
  status: 500,
  body: { error: { code: 'INTERNAL_ERROR', message } },
});

describe('DashboardPage: headcount', () => {
  it('shows the total number of employees, and the number in each currency', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const cards = await screen.findByRole('region', { name: 'Headcount' });
    expect(within(cards).getByText('Employees')).toBeInTheDocument();
    expect(within(cards).getByText('11')).toBeInTheDocument();
    expect(within(cards).getByText('Paid in INR')).toBeInTheDocument();
    expect(within(cards).getByText('6')).toBeInTheDocument();
    expect(within(cards).getByText('Paid in EUR')).toBeInTheDocument();
    expect(within(cards).getByText('Paid in USD')).toBeInTheDocument();
  });

  it('shows a loading message at first', () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });
});

describe('DashboardPage: salary statistics', () => {
  it('shows one row per currency, so currencies are never added together', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const table = await screen.findByRole('table', { name: 'Salary statistics' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('EUR');
    expect(rows[1]).toHaveTextContent('INR');
    expect(rows[1]).toHaveTextContent('6');
    expect(rows[2]).toHaveTextContent('USD');
  });

  it('shows the lowest, middle, average and highest salary, each with its currency', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const table = await screen.findByRole('table', { name: 'Salary statistics' });
    const inrRow = within(table).getByRole('row', { name: /INR/ });
    expect(inrRow).toHaveTextContent('1,200,000.00 INR');
    expect(inrRow).toHaveTextContent('2,400,000.00 INR');
    expect(inrRow).toHaveTextContent('2,400,000.50 INR');
    expect(inrRow).toHaveTextContent('4,800,000.00 INR');
  });

  it('never shows an amount without its currency', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const table = await screen.findByRole('table', { name: 'Salary statistics' });
    const amounts = within(table)
      .getAllByRole('cell')
      .map((cell) => cell.textContent ?? '')
      .filter((text) => /\d\.\d\d/.test(text));
    expect(amounts.length).toBeGreaterThan(8);
    for (const text of amounts) expect(text).toMatch(/\.\d\d [A-Z]{3}$/);
  });

  it('asks only for the tab that is showing', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    const addresses = requestedUrls(fake).join(' ');
    expect(addresses).toContain('/api/analytics/summary');
    expect(addresses).not.toContain('/api/analytics/by-country');
  });

  it('can group the statistics by country, with the country name', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.click(screen.getByRole('tab', { name: 'By country' }));

    const table = await screen.findByRole('table', { name: 'Salary statistics by country' });
    expect(within(table).getByText('India')).toBeInTheDocument();
    expect(within(table).getByText('United States')).toBeInTheDocument();
    expect(
      requestedUrls(fake).some((address) => address.startsWith('/api/analytics/by-country')),
    ).toBe(true);
  });

  it('can group by department, with one row for each currency inside a department', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.click(screen.getByRole('tab', { name: 'By department' }));

    const table = await screen.findByRole('table', { name: 'Salary statistics by department' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Engineering');
    expect(rows[0]).toHaveTextContent('INR');
    expect(rows[1]).toHaveTextContent('Engineering');
    expect(rows[1]).toHaveTextContent('USD');
  });

  it('can group by level', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.click(screen.getByRole('tab', { name: 'By level' }));

    expect(
      await screen.findByRole('table', { name: 'Salary statistics by level' }),
    ).toHaveTextContent('L3');
  });

  it('says so when no employee matches', async () => {
    startFakeServer({ summary: { body: { view: 'local', headcount: 0, groups: [] } } });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument();
  });

  it('shows a failure in the statistics without hiding the rest of the page', async () => {
    startFakeServer({ summary: failure('Statistics are unavailable.') });
    renderWithProviders(<DashboardPage />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent?.includes('Statistics are unavailable.'))).toBe(
      true,
    );
    expect(await screen.findByRole('list', { name: 'Recent salary changes' })).toBeInTheDocument();
  });
});

describe('DashboardPage: filters', () => {
  it('asks for active employees in their own currencies by default', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    expect(lastParams(fake, '/api/analytics/summary')).toEqual({ status: 'ACTIVE', view: 'local' });
  });

  it('passes each filter to every question the page asks', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IN');
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Engineering');
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'L3');
    await userEvent.selectOptions(screen.getByLabelText('Employees'), 'ALL');

    const expected = {
      country: 'IN',
      department: 'Engineering',
      level: 'L3',
      status: 'ALL',
      view: 'local',
    };
    await waitFor(() => expect(lastParams(fake, '/api/analytics/summary')).toEqual(expected));
    await waitFor(() =>
      expect(lastParams(fake, '/api/analytics/distribution')).toMatchObject(expected),
    );
    await waitFor(() =>
      expect(lastParams(fake, '/api/analytics/extremes')).toMatchObject(expected),
    );
  });

  it('reads the filters from the address, so a link can be shared', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />, '/?country=IN&level=L3&status=INACTIVE');
    await screen.findByRole('table', { name: 'Salary statistics' });

    expect(lastParams(fake, '/api/analytics/summary')).toEqual({
      country: 'IN',
      level: 'L3',
      status: 'INACTIVE',
      view: 'local',
    });
    expect(screen.getByLabelText('Country')).toHaveValue('IN');
    expect(screen.getByLabelText('Employees')).toHaveValue('INACTIVE');
  });

  it('has a Clear filters button only when something is filtered, and it resets everything', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />, '/?country=IN&view=usd');
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() =>
      expect(lastParams(fake, '/api/analytics/summary')).toEqual({
        status: 'ACTIVE',
        view: 'local',
      }),
    );
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('DashboardPage: the US dollar view', () => {
  it('is off by default', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    expect(screen.getByRole('radio', { name: /Each country's own currency/ })).toBeChecked();
    expect(screen.queryByText(/illustrative/i)).not.toBeInTheDocument();
  });

  it('converts everything to dollars, and says clearly that the rates are fixed and approximate', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.click(screen.getByRole('radio', { name: /US dollars/ }));

    const notice = await screen.findByText(/converted to US dollars/i);
    expect(notice).toHaveTextContent('2026-01-01');
    expect(notice).toHaveTextContent(/illustrative/i);
    expect(lastParams(fake, '/api/analytics/summary')).toMatchObject({ view: 'usd' });
    const table = await screen.findByRole('table', { name: 'Salary statistics' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(table).toHaveTextContent('20,000.00 USD');
  });

  it('has no currency choice in dollars, because everything is one currency', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />, '/?view=usd');
    await screen.findByRole('table', { name: 'Salary statistics' });

    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Salary distribution in USD' }),
    ).toBeInTheDocument();
  });

  it("can go back to each country's own currency", async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />, '/?view=usd');
    await screen.findByRole('table', { name: 'Salary statistics' });

    await userEvent.click(screen.getByRole('radio', { name: /Each country's own currency/ }));

    await waitFor(() =>
      expect(lastParams(fake, '/api/analytics/summary')).toMatchObject({ view: 'local' }),
    );
    expect(screen.queryByText(/converted to US dollars/i)).not.toBeInTheDocument();
  });
});

describe('DashboardPage: pay within one currency', () => {
  it('starts with the currency that has the most people', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);

    expect(
      await screen.findByRole('heading', { name: 'Salary distribution in INR' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toHaveValue('INR');
    expect(lastParams(fake, '/api/analytics/distribution')).toMatchObject({ currency: 'INR' });
    expect(lastParams(fake, '/api/analytics/extremes')).toMatchObject({ currency: 'INR' });
  });

  it('offers the currencies that people are paid in', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Salary distribution in INR' });

    const options = within(screen.getByLabelText('Currency')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['EUR', 'INR', 'USD']);
  });

  it('shows how many people are in each salary range', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const table = await screen.findByRole('table', { name: 'People in each salary range, in INR' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('1,200,000.00 INR to 2,400,000.00 INR');
    expect(rows[0]).toHaveTextContent('4');
    expect(rows[2]).toHaveTextContent('3,600,000.00 INR to 4,800,000.00 INR');
  });

  it('describes the chart in words, for people who cannot see it', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    expect(
      await screen.findByRole('img', { name: /number of employees in each salary range/i }),
    ).toBeInTheDocument();
  });

  it('changes the distribution and the highest and lowest paid when another currency is chosen', async () => {
    const fake = startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Salary distribution in INR' });

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');

    expect(
      await screen.findByRole('heading', { name: 'Salary distribution in USD' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(lastParams(fake, '/api/analytics/distribution')).toMatchObject({ currency: 'USD' }),
    );
    await waitFor(() =>
      expect(lastParams(fake, '/api/analytics/extremes')).toMatchObject({ currency: 'USD' }),
    );
  });

  it('lists the highest and lowest paid, with their salary and a link to each person', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const highest = await screen.findByRole('list', { name: 'Highest paid in INR' });
    const items = within(highest).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(
      within(items[0] as HTMLElement).getByRole('link', { name: 'Rahul Rao' }),
    ).toHaveAttribute('href', '/employees/5');
    expect(items[0]).toHaveTextContent('4,800,000.00 INR');
    expect(items[0]).toHaveTextContent('Engineering');

    const lowest = screen.getByRole('list', { name: 'Lowest paid in INR' });
    expect(within(lowest).getByRole('link', { name: 'Amit Das' })).toHaveAttribute(
      'href',
      '/employees/9',
    );
    expect(lowest).toHaveTextContent('1,200,000.00 INR');
  });

  it('says so when there are no salaries to show', async () => {
    startFakeServer({
      distribution: { body: { ...DISTRIBUTION, headcount: 0, min: null, max: null, buckets: [] } },
      extremes: { body: { ...EXTREMES, top: [], bottom: [] } },
    });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No salaries to show for these filters.')).toBeInTheDocument();
  });

  it('shows a failure in the chart without hiding the rest of the page', async () => {
    startFakeServer({ distribution: failure('Chart data is unavailable.') });
    renderWithProviders(<DashboardPage />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent?.includes('Chart data is unavailable.'))).toBe(
      true,
    );
    expect(await screen.findByRole('list', { name: 'Highest paid in INR' })).toBeInTheDocument();
  });
});

describe('DashboardPage: recent salary changes', () => {
  it('lists the latest changes with who, how much, why and when', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);

    const list = await screen.findByRole('list', { name: 'Recent salary changes' });
    const item = within(list).getByRole('listitem');
    expect(within(item).getByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/employees/1',
    );
    expect(item).toHaveTextContent('2,000,000.00 INR');
    expect(item).toHaveTextContent('2,400,000.00 INR');
    expect(item).toHaveTextContent('Annual review');
    expect(item).toHaveTextContent('1 Oct 2026');
  });

  it('says so when nothing has changed yet', async () => {
    startFakeServer({ recent: { body: { data: [] } } });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No salary changes yet.')).toBeInTheDocument();
  });
});

describe('DashboardPage: accessibility', () => {
  it('has no accessibility problems', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('table', { name: 'Salary statistics' });
    await screen.findByRole('list', { name: 'Highest paid in INR' });
    await screen.findByRole('list', { name: 'Recent salary changes' });

    expect(await findAccessibilityProblems()).toEqual([]);
  });

  it('has no accessibility problems in the US dollar view', async () => {
    startFakeServer();
    renderWithProviders(<DashboardPage />, '/?view=usd');
    await screen.findByText(/converted to US dollars/i);
    await screen.findByRole('list', { name: 'Highest paid in USD' });

    expect(await findAccessibilityProblems()).toEqual([]);
  });
});
