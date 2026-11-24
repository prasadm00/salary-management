import type { Employee } from '@acme/shared';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/format';
import { validateAmount, validateReason } from '@/lib/validation';
import { useChangeSalary } from './useEmployeeMutations';

interface EditSalaryDialogProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the salary was saved. */
  onSaved: () => void;
}

/** A pop-up for changing one employee's salary. A reason is always required. */
export function EditSalaryDialog({ employee, open, onOpenChange, onSaved }: EditSalaryDialogProps) {
  const { amount, currency } = employee.compensation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update salary for {employee.fullName}</DialogTitle>
          <DialogDescription>
            Current salary: {formatMoney(amount, currency)} per year. The reason is kept in the
            salary history.
          </DialogDescription>
        </DialogHeader>
        {/* The form is only drawn while the dialog is open, so it starts empty every time. */}
        <SalaryForm employee={employee} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

interface FieldErrors {
  amount?: string | undefined;
  reason?: string | undefined;
}

function SalaryForm({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string>();
  const amountInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLInputElement>(null);
  const change = useChangeSalary(employee.id);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(undefined);

    // First check what we can without asking the server.
    const problems: FieldErrors = {
      amount: validateAmount(amount),
      reason: validateReason(reason),
    };
    if (problems.amount || problems.reason) {
      setErrors(problems);
      (problems.amount ? amountInput : reasonInput).current?.focus();
      return;
    }
    setErrors({});

    change.mutate(
      { amount: amount.trim(), reason: reason.trim() },
      {
        onSuccess: () => {
          onSaved();
          onClose();
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return setServerError('Something went wrong.');
          // Show a message next to the field it is about. Anything else goes at the top.
          const fieldErrors = {
            amount: error.messageFor('amount'),
            reason: error.messageFor('reason'),
          };
          setErrors(fieldErrors);
          if (!fieldErrors.amount && !fieldErrors.reason) setServerError(error.message);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <FormField label={`New amount (${employee.compensation.currency})`} error={errors.amount}>
        {(field) => (
          <Input
            {...field}
            ref={amountInput}
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        )}
      </FormField>

      <FormField label="Reason" error={errors.reason}>
        {(field) => (
          <Input
            {...field}
            ref={reasonInput}
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
