import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** What an input needs to be connected to its label and its messages. */
export interface FieldProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  label: string;
  /** The problem to show under the field. */
  error?: string | undefined;
  /** Helpful text to show under the field, for example "Currency: INR". */
  hint?: string | undefined;
  /** Draws the input. Give it the props it receives. */
  children: (fieldProps: FieldProps) => ReactNode;
}

/**
 * A label, an input and its messages that belong together.
 * The label, the hint and the error are all tied to the input,
 * so a screen reader reads them when the field is focused.
 */
export function FormField({ label, error, hint, children }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
