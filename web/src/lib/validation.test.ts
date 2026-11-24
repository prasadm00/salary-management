import { describe, expect, it } from 'vitest';
import { validateAmount, validateNewEmployee, validateReason } from './validation';

describe('validateAmount', () => {
  it.each(['1', '10.5', '2400000.00', '0.01', '999999999999.99'])('accepts %s', (text) => {
    expect(validateAmount(text)).toBeUndefined();
  });

  it('ignores spaces around the amount', () => {
    expect(validateAmount('  2400000.00  ')).toBeUndefined();
  });

  it.each(['', '   '])('asks for an amount when it is empty: "%s"', (text) => {
    expect(validateAmount(text)).toBe('Enter an amount.');
  });

  it.each(['abc', '1e6', '1,000', '-5', '$5', '5.', '.5', '1 000'])(
    'says "digits only" for "%s"',
    (text) => {
      expect(validateAmount(text)).toBe('Use digits only, for example 2400000.00.');
    },
  );

  it.each(['0', '0.00', '000'])('refuses zero: "%s"', (text) => {
    expect(validateAmount(text)).toBe('Amount must be greater than zero.');
  });

  it.each(['10.001', '0.005', '1.123'])('refuses more than two decimals: "%s"', (text) => {
    expect(validateAmount(text)).toBe('Use at most two decimal places.');
  });

  it('refuses an amount with more than 12 digits before the point', () => {
    expect(validateAmount('1234567890123')).toBe('Amount is too large.');
    expect(validateAmount('123456789012')).toBeUndefined();
  });
});

describe('validateReason', () => {
  it.each(['', '   '])('asks for a reason when it is empty: "%s"', (text) => {
    expect(validateReason(text)).toBe('Enter a reason.');
  });

  it('wants at least 3 characters, not counting spaces around the text', () => {
    expect(validateReason('ab')).toBe('Reason must be at least 3 characters.');
    expect(validateReason('  ab  ')).toBe('Reason must be at least 3 characters.');
    expect(validateReason('abc')).toBeUndefined();
  });

  it('allows at most 255 characters', () => {
    expect(validateReason('a'.repeat(255))).toBeUndefined();
    expect(validateReason('a'.repeat(256))).toBe('Reason must be at most 255 characters.');
  });
});

describe('validateNewEmployee', () => {
  const valid = {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    department: 'Engineering',
    jobTitle: 'Engineer',
    level: 'L3',
    country: 'IN',
    hireDate: '2021-04-12',
    salary: '2000000.00',
  };

  it('finds no problems in a complete form', () => {
    expect(validateNewEmployee(valid, '2026-11-01')).toEqual({});
  });

  it('asks for every empty field', () => {
    const empty = {
      fullName: '',
      email: '',
      department: '',
      jobTitle: '',
      level: '',
      country: '',
      hireDate: '',
      salary: '',
    };

    expect(validateNewEmployee(empty, '2026-11-01')).toEqual({
      fullName: 'Enter the full name.',
      email: 'Enter the email address.',
      department: 'Enter the department.',
      jobTitle: 'Enter the job title.',
      level: 'Choose a level.',
      country: 'Choose a country.',
      hireDate: 'Enter the hire date.',
      salary: 'Enter an amount.',
    });
  });

  it.each(['no-at-sign', 'a@b', '@acme.example', 'a b@acme.example'])(
    'refuses the email "%s"',
    (email) => {
      expect(validateNewEmployee({ ...valid, email }, '2026-11-01').email).toBe(
        'Enter a valid email address.',
      );
    },
  );

  it('refuses a hire date in the future, but accepts today', () => {
    expect(validateNewEmployee({ ...valid, hireDate: '2026-11-02' }, '2026-11-01').hireDate).toBe(
      'The hire date cannot be in the future.',
    );
    expect(
      validateNewEmployee({ ...valid, hireDate: '2026-11-01' }, '2026-11-01').hireDate,
    ).toBeUndefined();
  });

  it('uses the same salary rules as the salary dialog', () => {
    expect(validateNewEmployee({ ...valid, salary: '-5' }, '2026-11-01').salary).toBe(
      'Use digits only, for example 2400000.00.',
    );
  });

  it('counts a field with only spaces as empty', () => {
    expect(validateNewEmployee({ ...valid, fullName: '   ' }, '2026-11-01').fullName).toBe(
      'Enter the full name.',
    );
  });
});
