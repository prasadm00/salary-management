// Quick checks on what the user typed, so mistakes show up before anything is sent.
// The server checks everything again, so these only need to catch the common mistakes.

/** Returns a message when the amount is not valid, or undefined when it is fine. */
export function validateAmount(text: string): string | undefined {
  const amount = text.trim();

  if (amount === '') return 'Enter an amount.';
  if (!/^\d+(\.\d+)?$/.test(amount)) return 'Use digits only, for example 2400000.00.';
  if (/^0+(\.0+)?$/.test(amount)) return 'Amount must be greater than zero.';

  const [whole = '', decimals = ''] = amount.split('.');
  if (decimals.length > 2) return 'Use at most two decimal places.';
  if (whole.length > 12) return 'Amount is too large.';
  return undefined;
}

/** Returns a message when the reason for a salary change is not valid. */
export function validateReason(text: string): string | undefined {
  const reason = text.trim();

  if (reason === '') return 'Enter a reason.';
  if (reason.length < 3) return 'Reason must be at least 3 characters.';
  if (reason.length > 255) return 'Reason must be at most 255 characters.';
  return undefined;
}

export interface NewEmployeeForm {
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  level: string;
  country: string;
  hireDate: string;
  salary: string;
}

export type NewEmployeeErrors = Partial<Record<keyof NewEmployeeForm, string>>;

/** Checks the "add employee" form. `today` is given as YYYY-MM-DD. */
export function validateNewEmployee(form: NewEmployeeForm, today: string): NewEmployeeErrors {
  const errors: NewEmployeeErrors = {};

  if (form.fullName.trim() === '') errors.fullName = 'Enter the full name.';

  if (form.email.trim() === '') errors.email = 'Enter the email address.';
  else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';

  if (form.department.trim() === '') errors.department = 'Enter the department.';
  if (form.jobTitle.trim() === '') errors.jobTitle = 'Enter the job title.';
  if (form.level === '') errors.level = 'Choose a level.';
  if (form.country === '') errors.country = 'Choose a country.';

  if (form.hireDate === '') errors.hireDate = 'Enter the hire date.';
  else if (form.hireDate > today) errors.hireDate = 'The hire date cannot be in the future.';

  const salaryProblem = validateAmount(form.salary);
  if (salaryProblem) errors.salary = salaryProblem;

  return errors;
}
