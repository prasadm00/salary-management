import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTER_OPTIONS, anEmployee } from '@/tests/fixtures';
import {
  findAccessibilityProblems,
  mockFetch,
  renderWithProviders,
  requestedUrls,
  sentJson,
  type FakeReply,
} from '@/tests/testUtils';
import { EmployeeFormPage } from './EmployeeFormPage';

beforeEach(() => {
  // Fix "today", so the hire-date checks give the same answer every day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function showForm(createReply?: FakeReply) {
  const fake = mockFetch((url, init) => {
    if (url.pathname === '/api/meta/filters') return { body: FILTER_OPTIONS };
    if (url.pathname === '/api/employees' && init.method === 'POST') {
      return createReply ?? { status: 201, body: anEmployee({ id: 7 }) };
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
  });
  renderWithProviders(
    <Routes>
      <Route path="/employees/new" element={<EmployeeFormPage />} />
      <Route path="/employees/:id" element={<h1>Profile page</h1>} />
    </Routes>,
    '/employees/new',
  );
  return fake;
}

const user = () => userEvent.setup();

/** Fills the whole form with valid values. */
async function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    'Full name': 'Asha Rao',
    Email: 'asha.rao@acme.example',
    Department: 'Engineering',
    'Job title': 'Software Engineer',
    'Hire date': '2021-04-12',
    'Annual base salary': '2000000.00',
    ...overrides,
  };
  const typing = user();
  for (const [label, value] of Object.entries(values)) {
    const box = screen.getByLabelText(label);
    await typing.clear(box);
    if (value) await typing.type(box, value);
  }
  await typing.selectOptions(screen.getByLabelText('Level'), overrides['Level'] ?? 'L3');
  await typing.selectOptions(screen.getByLabelText('Country'), overrides['Country'] ?? 'IN');
}

/** The body of the request that created the employee. */
function postedBody(fake: ReturnType<typeof mockFetch>) {
  const call = fake.mock.calls.find(([, init]) => init?.method === 'POST');
  return sentJson(call?.[1]);
}

describe('EmployeeFormPage: the form', () => {
  it('has a labelled field for everything the employee needs', () => {
    showForm();

    expect(screen.getByRole('heading', { name: 'Add employee' })).toBeInTheDocument();
    for (const label of [
      'Full name',
      'Email',
      'Department',
      'Job title',
      'Level',
      'Country',
      'Hire date',
      'Annual base salary',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('offers the countries and levels as choices', () => {
    showForm();

    expect(screen.getByRole('option', { name: 'India' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Brazil' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'L6' })).toBeInTheDocument();
  });

  it('suggests the departments that exist, but allows a new one', async () => {
    showForm();

    const input = screen.getByLabelText('Department');
    const listId = input.getAttribute('list') ?? '';
    await waitFor(() => expect(document.querySelectorAll(`#${listId} option`)).toHaveLength(2));
    expect(
      [...document.querySelectorAll(`#${listId} option`)].map((o) => o.getAttribute('value')),
    ).toEqual(['Engineering', 'Sales']);
  });

  it('shows which currency the salary is in, once a country is chosen', async () => {
    showForm();
    expect(screen.getByText('Choose a country to see the currency.')).toBeInTheDocument();

    await user().selectOptions(screen.getByLabelText('Country'), 'DE');

    expect(screen.getByText('Salary currency: EUR (set by the country).')).toBeInTheDocument();
  });

  it('does not allow a hire date in the future', () => {
    showForm();

    expect(screen.getByLabelText('Hire date')).toHaveAttribute('max', '2026-11-01');
  });

  it('has a way to leave without saving', () => {
    showForm();

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/employees');
  });
});

describe('EmployeeFormPage: checking before sending', () => {
  it('shows a message next to every empty field, and sends nothing', async () => {
    const fake = showForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText('Enter the full name.')).toBeInTheDocument();
    for (const message of [
      'Enter the email address.',
      'Enter the department.',
      'Enter the job title.',
      'Choose a level.',
      'Choose a country.',
      'Enter the hire date.',
      'Enter an amount.',
    ]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(requestedUrls(fake).some((address) => address === '/api/employees')).toBe(false);
  });

  it('moves the cursor to the first field with a problem', async () => {
    showForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveFocus());
  });

  it.each([
    ['Email', 'not-an-email', 'Enter a valid email address.'],
    ['Annual base salary', '-5', 'Use digits only, for example 2400000.00.'],
    ['Annual base salary', '10.001', 'Use at most two decimal places.'],
    ['Hire date', '2026-11-02', 'The hire date cannot be in the future.'],
  ])('refuses %s "%s"', async (label, value, message) => {
    const fake = showForm();
    await fillForm({ [label]: value });

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fake.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});

describe('EmployeeFormPage: saving', () => {
  it('sends the employee to the server, then opens their page', async () => {
    const fake = showForm();
    await fillForm({ 'Full name': '  Asha Rao  ', Email: ' asha.rao@acme.example ' });

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
    expect(postedBody(fake)).toEqual({
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      level: 'L3',
      country: 'IN',
      hireDate: '2021-04-12',
      salary: '2000000.00',
    });
  });

  it('does not send a currency, because the server sets it from the country', async () => {
    const fake = showForm();
    await fillForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));
    await screen.findByRole('heading', { name: 'Profile page' });

    expect(postedBody(fake)).not.toHaveProperty('currency');
  });

  it('shows "Adding…" and cannot be pressed twice while saving', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderWithProviders(<EmployeeFormPage />);
    await fillForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByRole('button', { name: 'Adding…' })).toBeDisabled();
  });
});

describe('EmployeeFormPage: when the server says no', () => {
  it('shows a duplicate email next to the email field', async () => {
    showForm({
      status: 409,
      body: {
        error: {
          code: 'CONFLICT',
          message: 'An employee with this email already exists.',
          details: [{ field: 'email', message: 'This email is already used.' }],
        },
      },
    });
    await fillForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText('This email is already used.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('heading', { name: 'Profile page' })).not.toBeInTheDocument();
  });

  it('shows a problem with the salary next to the salary field', async () => {
    showForm({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          details: [{ field: 'salary', message: 'Amount is too large.' }],
        },
      },
    });
    await fillForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText('Amount is too large.')).toBeInTheDocument();
    expect(screen.getByLabelText('Annual base salary')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows any other problem at the top, and keeps what was typed', async () => {
    showForm({
      status: 500,
      body: {
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      },
    });
    await fillForm();

    await user().click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.getByLabelText('Full name')).toHaveValue('Asha Rao');
    expect(screen.getByRole('button', { name: 'Add employee' })).toBeEnabled();
  });
});

describe('EmployeeFormPage: accessibility', () => {
  it('has no accessibility problems', async () => {
    showForm();

    expect(await findAccessibilityProblems()).toEqual([]);
  });

  it('has no accessibility problems while showing errors', async () => {
    showForm();
    await user().click(screen.getByRole('button', { name: 'Add employee' }));
    await screen.findByText('Enter the full name.');

    expect(await findAccessibilityProblems()).toEqual([]);
  });
});
