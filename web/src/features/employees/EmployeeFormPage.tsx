import { COUNTRIES, LEVELS } from '@acme/shared';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { getFilterOptions } from '@/api/meta';
import { FormField, type FieldProps } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  validateNewEmployee,
  type NewEmployeeErrors,
  type NewEmployeeForm,
} from '@/lib/validation';
import { useCreateEmployee } from './useEmployeeMutations';

const EMPTY_FORM: NewEmployeeForm = {
  fullName: '',
  email: '',
  department: '',
  jobTitle: '',
  level: '',
  country: '',
  hireDate: '',
  salary: '',
};

/** The fields in the order they appear, so a problem can move the cursor to the first one. */
const FIELD_ORDER: (keyof NewEmployeeForm)[] = [
  'fullName',
  'email',
  'department',
  'jobTitle',
  'level',
  'country',
  'hireDate',
  'salary',
];

/** A form for adding a new employee together with their first salary. */
export function EmployeeFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewEmployeeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<NewEmployeeErrors>({});
  const [serverError, setServerError] = useState<string>();
  const formElement = useRef<HTMLFormElement>(null);
  const options = useQuery({ queryKey: ['filter-options'], queryFn: getFilterOptions });
  const create = useCreateEmployee();

  const today = new Date().toISOString().slice(0, 10);
  // The server sets the currency from the country. We only show it, so nobody is surprised.
  const currency = COUNTRIES.find((country) => country.code === form.country)?.currency;

  /** Makes the function that updates one field. */
  const setField = (name: keyof NewEmployeeForm) => (value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  function focusFirstProblem(problems: NewEmployeeErrors) {
    const first = FIELD_ORDER.find((name) => problems[name]);
    const field = first ? formElement.current?.elements.namedItem(first) : null;
    if (field instanceof HTMLElement) field.focus();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(undefined);

    const problems = validateNewEmployee(form, today);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return focusFirstProblem(problems);

    create.mutate(
      {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        jobTitle: form.jobTitle.trim(),
        level: form.level,
        country: form.country,
        hireDate: form.hireDate,
        salary: form.salary.trim(),
      },
      {
        onSuccess: (employee) => void navigate(`/employees/${employee.id}`),
        onError: (error) => {
          if (!(error instanceof ApiError)) return setServerError('Something went wrong.');
          // Show a message next to the field it is about. Anything else goes at the top.
          const fieldErrors: NewEmployeeErrors = {};
          for (const name of FIELD_ORDER) fieldErrors[name] = error.messageFor(name);
          setErrors(fieldErrors);
          if (!Object.values(fieldErrors).some(Boolean)) setServerError(error.message);
        },
      },
    );
  }

  /** The props every text box shares. */
  const textBox = (name: keyof NewEmployeeForm, field: FieldProps) => ({
    ...field,
    name,
    value: form[name],
    onChange: (event: { target: { value: string } }) => setField(name)(event.target.value),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Add employee</h1>

      <form ref={formElement} onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Full name" error={errors.fullName}>
            {(field) => <Input {...textBox('fullName', field)} autoComplete="off" />}
          </FormField>

          <FormField label="Email" error={errors.email}>
            {(field) => <Input {...textBox('email', field)} type="email" autoComplete="off" />}
          </FormField>

          <FormField label="Department" error={errors.department}>
            {(field) => (
              <>
                <Input
                  {...textBox('department', field)}
                  list="department-options"
                  autoComplete="off"
                />
                {/* Suggestions from the departments that exist. Typing a new one is fine too. */}
                <datalist id="department-options">
                  {options.data?.departments.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>

          <FormField label="Job title" error={errors.jobTitle}>
            {(field) => <Input {...textBox('jobTitle', field)} autoComplete="off" />}
          </FormField>

          <FormField label="Level" error={errors.level}>
            {(field) => (
              <NativeSelect {...textBox('level', field)} className="w-full">
                <NativeSelectOption value="">Choose a level</NativeSelectOption>
                {LEVELS.map((level) => (
                  <NativeSelectOption key={level} value={level}>
                    {level}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField label="Country" error={errors.country}>
            {(field) => (
              <NativeSelect {...textBox('country', field)} className="w-full">
                <NativeSelectOption value="">Choose a country</NativeSelectOption>
                {COUNTRIES.map((country) => (
                  <NativeSelectOption key={country.code} value={country.code}>
                    {country.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField label="Hire date" error={errors.hireDate}>
            {(field) => <Input {...textBox('hireDate', field)} type="date" max={today} />}
          </FormField>

          <FormField
            label="Annual base salary"
            error={errors.salary}
            hint={
              currency
                ? `Salary currency: ${currency} (set by the country).`
                : 'Choose a country to see the currency.'
            }
          >
            {(field) => (
              <Input {...textBox('salary', field)} inputMode="decimal" autoComplete="off" />
            )}
          </FormField>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add employee'}
          </Button>
          <Link to="/employees" className={buttonVariants({ variant: 'outline' })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
