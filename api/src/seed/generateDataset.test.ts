import { COUNTRIES, USD_PER_UNIT } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import {
  COUNTRY_FACTOR,
  COUNTRY_WEIGHTS,
  DEPARTMENT_FACTOR,
  DEPARTMENT_WEIGHTS,
  EMPLOYEE_COUNT,
  FIRST_HIRE_DATE,
  LEVEL_BANDS,
  LEVEL_WEIGHTS,
  REFERENCE_DATE,
} from './seedData.js';
import { generateDataset } from './generateDataset.js';

// Built once. Generating 10,000 employees takes a few milliseconds.
const dataset = generateDataset();
const { employees, compensations, changes } = dataset;

const currencyOf = (country: string) => COUNTRIES.find((c) => c.code === country)?.currency;
const shareOf = (count: number) => (count / employees.length) * 100;

// Group the history rows by employee once, so each lookup below is instant.
const historyByEmployee = new Map<number, typeof changes>();
for (const change of changes) {
  historyByEmployee.set(change.employeeId, [
    ...(historyByEmployee.get(change.employeeId) ?? []),
    change,
  ]);
}

/** All history rows of one employee, oldest first. */
function historyOf(employeeId: number) {
  return historyByEmployee.get(employeeId) ?? [];
}

describe('generateDataset: size and repeatability', () => {
  it('makes exactly 10,000 employees by default', () => {
    expect(EMPLOYEE_COUNT).toBe(10000);
    expect(employees).toHaveLength(10000);
    expect(compensations).toHaveLength(10000);
  });

  it('can make a different number of employees', () => {
    expect(generateDataset(25, 1).employees).toHaveLength(25);
  });

  it('gives the same data every time for the same seed', () => {
    expect(generateDataset(300, 42)).toEqual(generateDataset(300, 42));
  });

  it('gives different data for a different seed', () => {
    expect(generateDataset(300, 42)).not.toEqual(generateDataset(300, 43));
  });

  it('does not depend on the current time', () => {
    const before = generateDataset(50, 9);
    const realNow = Date.now;
    Date.now = () => new Date('2040-01-01').getTime();
    try {
      expect(generateDataset(50, 9)).toEqual(before);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('generateDataset: employees', () => {
  it('numbers employees 1, 2, 3... and gives codes like EMP-000001', () => {
    expect(employees.map((e) => e.id)).toEqual(Array.from({ length: 10000 }, (_, i) => i + 1));
    expect(employees[0]?.employeeCode).toBe('EMP-000001');
    expect(employees[9999]?.employeeCode).toBe('EMP-010000');
  });

  it('has unique employee codes and unique emails', () => {
    expect(new Set(employees.map((e) => e.employeeCode)).size).toBe(10000);
    expect(new Set(employees.map((e) => e.email)).size).toBe(10000);
  });

  it('writes emails in lower case, in the fictional acme.example domain', () => {
    for (const employee of employees) {
      expect(employee.email).toMatch(/^[a-z]+\.[a-z]+\d*@acme\.example$/);
    }
  });

  it('gives every employee a name, a department and a job title', () => {
    for (const employee of employees) {
      expect(employee.fullName).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
      expect(employee.department.length).toBeGreaterThan(0);
      expect(employee.jobTitle.length).toBeGreaterThan(0);
    }
  });

  it('matches the job title to the level: L6 is head of the department', () => {
    const head = employees.find((e) => e.level === 'L6');

    expect(head?.jobTitle).toBe(`Head of ${head?.department}`);
  });

  it('uses all 10 countries, so pay can be compared across countries', () => {
    expect(new Set(employees.map((e) => e.country)).size).toBe(10);
  });

  it('uses every department and every level', () => {
    expect(new Set(employees.map((e) => e.department)).size).toBe(DEPARTMENT_WEIGHTS.length);
    expect(new Set(employees.map((e) => e.level))).toEqual(
      new Set(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']),
    );
  });

  it.each(COUNTRY_WEIGHTS)('has about $weight% of employees in $value', ({ value, weight }) => {
    const share = shareOf(employees.filter((e) => e.country === value).length);

    expect(Math.abs(share - weight)).toBeLessThan(2);
  });

  it.each(DEPARTMENT_WEIGHTS)('has about $weight% of employees in $value', ({ value, weight }) => {
    const share = shareOf(employees.filter((e) => e.department === value).length);

    expect(Math.abs(share - weight)).toBeLessThan(2);
  });

  it.each(LEVEL_WEIGHTS)('has about $weight% of employees at level $value', ({ value, weight }) => {
    const share = shareOf(employees.filter((e) => e.level === value).length);

    expect(Math.abs(share - weight)).toBeLessThan(2);
  });

  it('makes about 5% of employees inactive', () => {
    const inactive = employees.filter((e) => e.employmentStatus === 'INACTIVE').length;

    expect(shareOf(inactive)).toBeGreaterThan(4);
    expect(shareOf(inactive)).toBeLessThan(6);
  });

  it('hires people between 2010-01-01 and the day before the reference date', () => {
    for (const employee of employees) {
      expect(employee.hireDate.getTime()).toBeGreaterThanOrEqual(FIRST_HIRE_DATE.getTime());
      expect(employee.hireDate.getTime()).toBeLessThan(REFERENCE_DATE.getTime());
    }
  });
});

describe('generateDataset: salaries', () => {
  it('gives every employee one current salary, in the currency of their country', () => {
    expect(compensations.map((c) => c.employeeId)).toEqual(employees.map((e) => e.id));
    for (const employee of employees) {
      expect(compensations[employee.id - 1]?.currency).toBe(currencyOf(employee.country));
    }
  });

  it('writes amounts as text with two decimals', () => {
    for (const compensation of compensations) expect(compensation.amount).toMatch(/^\d+\.00$/);
    for (const change of changes) expect(change.newAmount).toMatch(/^\d+\.00$/);
  });

  it('keeps every starting salary inside the band for its level (after the country and department adjustment)', () => {
    for (const employee of employees) {
      const start = historyOf(employee.id)[0];
      const currency = currencyOf(employee.country) as keyof typeof USD_PER_UNIT;
      const [low, high] = LEVEL_BANDS[employee.level];

      // Turn the salary back into plain US dollars, undoing the two adjustments.
      const usd = Number(start?.newAmount) * USD_PER_UNIT[currency];
      const adjusted =
        usd / COUNTRY_FACTOR[employee.country] / DEPARTMENT_FACTOR[employee.department];

      // 1% of room, because amounts are rounded to whole hundreds.
      expect(adjusted).toBeGreaterThanOrEqual(low * 0.99);
      expect(adjusted).toBeLessThanOrEqual(high * 1.01);
    }
  });

  it('pays higher levels more, on average, within a country and department', () => {
    const average = (level: string) => {
      const salaries = employees
        .filter((e) => e.level === level && e.country === 'US' && e.department === 'Engineering')
        .map((e) => Number(compensations[e.id - 1]?.amount));
      return salaries.reduce((sum, value) => sum + value, 0) / salaries.length;
    };

    expect(average('L1')).toBeLessThan(average('L3'));
    expect(average('L3')).toBeLessThan(average('L6'));
  });

  it('pays the same level less in India than in the United States', () => {
    const inUsd = (country: string) => {
      const salaries = employees
        .filter((e) => e.country === country && e.level === 'L3')
        .map(
          (e) =>
            Number(compensations[e.id - 1]?.amount) *
            USD_PER_UNIT[currencyOf(country) as keyof typeof USD_PER_UNIT],
        );
      return salaries.reduce((sum, value) => sum + value, 0) / salaries.length;
    };

    expect(inUsd('IN')).toBeLessThan(inUsd('US'));
  });
});

describe('generateDataset: salary history', () => {
  it('starts every history with the first salary: no old amount, reason "Initial salary", dated on the hire date', () => {
    for (const employee of employees) {
      const first = historyOf(employee.id)[0];

      expect(first).toMatchObject({ oldAmount: null, reason: 'Initial salary' });
      expect(first?.changedAt).toEqual(employee.hireDate);
    }
  });

  it('makes the current salary equal to the newest history row, with the same date', () => {
    for (const employee of employees) {
      const newest = historyOf(employee.id).at(-1);
      const current = compensations[employee.id - 1];

      expect(current?.amount).toBe(newest?.newAmount);
      expect(current?.effectiveDate).toEqual(newest?.changedAt);
    }
  });

  it('gives about 40% of employees one to three raises', () => {
    const withRaises = employees.filter((e) => historyOf(e.id).length > 1);
    const counts = withRaises.map((e) => historyOf(e.id).length - 1);

    expect(shareOf(withRaises.length)).toBeGreaterThan(35);
    expect(shareOf(withRaises.length)).toBeLessThan(45);
    expect(Math.max(...counts)).toBe(3);
    expect(Math.min(...counts)).toBe(1);
  });

  it('chains the raises: each old amount is the previous new amount, and every raise changes the pay', () => {
    for (const employee of employees) {
      const history = historyOf(employee.id);
      history.slice(1).forEach((row, index) => {
        expect(row.oldAmount).toBe(history[index]?.newAmount);
        expect(row.newAmount).not.toBe(row.oldAmount);
      });
    }
  });

  it('makes each raise between 3% and 15% (allowing for rounding to whole hundreds)', () => {
    for (const employee of employees) {
      const history = historyOf(employee.id);
      history.slice(1).forEach((row) => {
        const growth = (Number(row.newAmount) / Number(row.oldAmount) - 1) * 100;

        expect(growth).toBeGreaterThan(2.5);
        expect(growth).toBeLessThan(15.5);
      });
    }
  });

  it('dates raises after the hire date and before the reference date, in order', () => {
    for (const employee of employees) {
      const history = historyOf(employee.id);
      history.slice(1).forEach((row, index) => {
        expect(row.changedAt.getTime()).toBeGreaterThan(
          history[index]?.changedAt.getTime() ?? Infinity,
        );
        expect(row.changedAt.getTime()).toBeLessThan(REFERENCE_DATE.getTime());
      });
    }
  });

  it('uses the currency of the employee on every history row', () => {
    for (const change of changes) {
      expect(change.currency).toBe(currencyOf(employees[change.employeeId - 1]?.country ?? ''));
    }
  });

  it('lists history rows grouped by employee, so they are saved in a stable order', () => {
    const ids = changes.map((change) => change.employeeId);

    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
