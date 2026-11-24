import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anEmployee } from '@/tests/fixtures';
import { mockFetch, renderWithProviders, requestedUrls, sentJson } from '@/tests/testUtils';
import { EditSalaryDialog } from './EditSalaryDialog';

const ASHA = anEmployee();

afterEach(() => vi.unstubAllGlobals());

function openDialog(
  overrides: { onSaved?: () => void; onOpenChange?: (open: boolean) => void } = {},
) {
  const onSaved = overrides.onSaved ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  renderWithProviders(
    <EditSalaryDialog employee={ASHA} open onOpenChange={onOpenChange} onSaved={onSaved} />,
  );
  return { onSaved, onOpenChange };
}

const amountBox = () => screen.getByLabelText('New amount (INR)');
const reasonBox = () => screen.getByLabelText('Reason');
const saveButton = () => screen.getByRole('button', { name: 'Save' });

/** What the page sent to the server, as an object. */
function sentBody(fake: ReturnType<typeof mockFetch>) {
  const [, init] = fake.mock.calls[0] ?? [];
  return sentJson(init);
}

describe('EditSalaryDialog: what it shows', () => {
  it('names the employee and shows the current salary, so the change is clear', () => {
    mockFetch(() => ({ body: {} }));
    openDialog();

    expect(screen.getByRole('dialog', { name: 'Update salary for Asha Rao' })).toBeInTheDocument();
    expect(screen.getByText(/2,400,000\.00 INR/)).toBeInTheDocument();
  });

  it('puts the currency in the label, because it cannot be changed here', () => {
    mockFetch(() => ({ body: {} }));
    openDialog();

    expect(amountBox()).toBeInTheDocument();
    expect(reasonBox()).toBeInTheDocument();
  });

  it('shows nothing when it is closed', () => {
    mockFetch(() => ({ body: {} }));
    renderWithProviders(
      <EditSalaryDialog employee={ASHA} open={false} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('EditSalaryDialog: checking the form before sending', () => {
  it('shows a message next to each empty field, and sends nothing', async () => {
    const fake = mockFetch(() => ({ body: {} }));
    openDialog();

    await userEvent.click(saveButton());

    expect(await screen.findByText('Enter an amount.')).toBeInTheDocument();
    expect(screen.getByText('Enter a reason.')).toBeInTheDocument();
    expect(fake).not.toHaveBeenCalled();
  });

  it('moves the cursor to the first field with a problem', async () => {
    mockFetch(() => ({ body: {} }));
    openDialog();

    await userEvent.click(saveButton());

    await waitFor(() => expect(amountBox()).toHaveFocus());
  });

  it('links each message to its field, for screen readers', async () => {
    mockFetch(() => ({ body: {} }));
    openDialog();

    await userEvent.click(saveButton());

    const message = await screen.findByText('Enter an amount.');
    expect(amountBox()).toHaveAttribute('aria-invalid', 'true');
    expect(amountBox().getAttribute('aria-describedby')).toContain(message.id);
  });

  it.each([
    ['-5', 'Use digits only, for example 2400000.00.'],
    ['0', 'Amount must be greater than zero.'],
    ['10.001', 'Use at most two decimal places.'],
  ])('refuses the amount "%s"', async (amount, message) => {
    const fake = mockFetch(() => ({ body: {} }));
    openDialog();

    await userEvent.type(amountBox(), amount);
    await userEvent.type(reasonBox(), 'Annual review');
    await userEvent.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fake).not.toHaveBeenCalled();
  });

  it('refuses a reason that is too short', async () => {
    const fake = mockFetch(() => ({ body: {} }));
    openDialog();

    await userEvent.type(amountBox(), '2500000');
    await userEvent.type(reasonBox(), 'ab');
    await userEvent.click(saveButton());

    expect(await screen.findByText('Reason must be at least 3 characters.')).toBeInTheDocument();
    expect(fake).not.toHaveBeenCalled();
  });
});

describe('EditSalaryDialog: saving', () => {
  it('sends the new amount and the reason, then closes and tells the page', async () => {
    const fake = mockFetch(() => ({
      body: anEmployee({
        compensation: { amount: '2500000.00', currency: 'INR', effectiveDate: '2026-11-01' },
      }),
    }));
    const { onSaved, onOpenChange } = openDialog();

    await userEvent.type(amountBox(), '  2500000  ');
    await userEvent.type(reasonBox(), '  Annual review 2026  ');
    await userEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(requestedUrls(fake)).toEqual(['/api/employees/1/compensation']);
    expect(fake.mock.calls[0]?.[1]?.method).toBe('PATCH');
    expect(sentBody(fake)).toEqual({ amount: '2500000', reason: 'Annual review 2026' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cannot be saved twice while it is saving', async () => {
    let finish: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = () => resolve(new Response(JSON.stringify(ASHA), { status: 200 }));
          }),
      ),
    );
    openDialog();
    await userEvent.type(amountBox(), '2500000');
    await userEvent.type(reasonBox(), 'Annual review');

    await userEvent.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    finish?.();
  });

  it('closes without sending anything when Cancel is pressed', async () => {
    const fake = mockFetch(() => ({ body: {} }));
    const { onOpenChange } = openDialog();

    await userEvent.type(amountBox(), '2500000');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fake).not.toHaveBeenCalled();
  });
});

describe('EditSalaryDialog: when the server says no', () => {
  const reject = (
    status: number,
    code: string,
    message: string,
    details: { field: string; message: string }[] = [],
  ) => mockFetch(() => ({ status, body: { error: { code, message, details } } }));

  it('shows the server message next to the amount when the salary did not change', async () => {
    reject(422, 'BUSINESS_RULE_VIOLATION', 'The salary was not changed.', [
      { field: 'amount', message: 'The new amount is the same as the current amount.' },
    ]);
    const { onSaved } = openDialog();

    await userEvent.type(amountBox(), '2400000');
    await userEvent.type(reasonBox(), 'No real change');
    await userEvent.click(saveButton());

    expect(
      await screen.findByText('The new amount is the same as the current amount.'),
    ).toBeInTheDocument();
    expect(amountBox()).toHaveAttribute('aria-invalid', 'true');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the server message next to the reason', async () => {
    reject(400, 'VALIDATION_ERROR', 'Some fields are invalid.', [
      { field: 'reason', message: 'A reason is required.' },
    ]);
    openDialog();

    await userEvent.type(amountBox(), '2500000');
    await userEvent.type(reasonBox(), 'Annual review');
    await userEvent.click(saveButton());

    expect(await screen.findByText('A reason is required.')).toBeInTheDocument();
    expect(reasonBox()).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows other errors at the top of the dialog, and keeps what was typed', async () => {
    reject(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    openDialog();

    await userEvent.type(amountBox(), '2500000');
    await userEvent.type(reasonBox(), 'Annual review');
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(amountBox()).toHaveValue('2500000');
    expect(reasonBox()).toHaveValue('Annual review');
    expect(saveButton()).toBeEnabled();
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    openDialog();

    await userEvent.type(amountBox(), '2500000');
    await userEvent.type(reasonBox(), 'Annual review');
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });

  it('clears the old messages when saving again', async () => {
    let fail = true;
    mockFetch(() =>
      fail
        ? { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Oops' } } }
        : { body: ASHA },
    );
    openDialog();
    await userEvent.type(amountBox(), '2500000');
    await userEvent.type(reasonBox(), 'Annual review');
    await userEvent.click(saveButton());
    await screen.findByRole('alert');

    fail = false;
    await userEvent.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
