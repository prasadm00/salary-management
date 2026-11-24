import { USD_PER_UNIT, type CountryCode, type Level } from '@acme/shared';
import { currencyForCountry } from '../domain/currency.js';
import { pickOne, pickWeighted, randomInt, createRandom } from './random.js';
import {
  COUNTRY_FACTOR,
  COUNTRY_WEIGHTS,
  DEPARTMENT_FACTOR,
  DEPARTMENT_WEIGHTS,
  EMPLOYEE_COUNT,
  FIRST_HIRE_DATE,
  INACTIVE_PERCENT,
  LEVEL_BANDS,
  LEVEL_WEIGHTS,
  NAMES_BY_COUNTRY,
  RAISE_PERCENT,
  RAISE_REASONS,
  REFERENCE_DATE,
  ROLE_BY_DEPARTMENT,
  SEED,
  TITLE_PREFIX,
  type Department,
} from './seedData.js';

// The rows below match the database tables, so they can be saved as they are.

export interface SeedEmployeeRow {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: Department;
  jobTitle: string;
  level: Level;
  country: CountryCode;
  employmentStatus: 'ACTIVE' | 'INACTIVE';
  hireDate: Date;
}

export interface SeedCompensationRow {
  employeeId: number;
  amount: string;
  currency: string;
  effectiveDate: Date;
}

export interface SeedChangeRow {
  employeeId: number;
  oldAmount: string | null;
  newAmount: string;
  currency: string;
  reason: string;
  changedAt: Date;
}

export interface SeedDataset {
  employees: SeedEmployeeRow[];
  compensations: SeedCompensationRow[];
  changes: SeedChangeRow[];
}

/**
 * Makes fictional employees, their current salary and their salary history, all in memory.
 * It never touches the database. The same seed always gives the same data.
 */
export function generateDataset(count = EMPLOYEE_COUNT, seed = SEED): SeedDataset {
  const random = createRandom(seed);
  const emailsUsed = new Map<string, number>();
  const dataset: SeedDataset = { employees: [], compensations: [], changes: [] };

  for (let id = 1; id <= count; id += 1) {
    const country = pickWeighted(random, COUNTRY_WEIGHTS);
    const department = pickWeighted(random, DEPARTMENT_WEIGHTS);
    const level = pickWeighted(random, LEVEL_WEIGHTS);
    const hireDate = pickHireDate(random);
    const { fullName, email } = pickName(random, country, emailsUsed);

    dataset.employees.push({
      id,
      employeeCode: `EMP-${String(id).padStart(6, '0')}`,
      fullName,
      email,
      department,
      jobTitle: jobTitleFor(level, department),
      level,
      country,
      employmentStatus: randomInt(random, 1, 100) <= INACTIVE_PERCENT ? 'INACTIVE' : 'ACTIVE',
      hireDate,
    });

    const currency = currencyForCountry(country);
    const startingAmount = startingSalary(random, country, department, level);
    const history = makeHistory(random, id, hireDate, startingAmount, currency);

    dataset.changes.push(...history);
    // The current salary is the newest row of the history.
    const newest = history[history.length - 1] as SeedChangeRow;
    dataset.compensations.push({
      employeeId: id,
      amount: newest.newAmount,
      currency,
      effectiveDate: newest.changedAt,
    });
  }

  return dataset;
}

function jobTitleFor(level: Level, department: Department): string {
  if (level === 'L6') return `Head of ${department}`;
  return `${TITLE_PREFIX[level]}${ROLE_BY_DEPARTMENT[department]}`;
}

/** A random hire date from the first hire date up to the day before the reference date. */
function pickHireDate(random: () => number): Date {
  const days = daysBetween(FIRST_HIRE_DATE, REFERENCE_DATE);
  return addDays(FIRST_HIRE_DATE, randomInt(random, 0, days - 1));
}

/** A name from the country's region, with an email that is not used by anyone else. */
function pickName(random: () => number, country: CountryCode, emailsUsed: Map<string, number>) {
  const names = NAMES_BY_COUNTRY[country];
  const first = pickOne(random, names.first);
  const last = pickOne(random, names.last);

  // The second "asha.rao" becomes "asha.rao2", and so on.
  const base = `${first}.${last}`.toLowerCase();
  const timesUsed = (emailsUsed.get(base) ?? 0) + 1;
  emailsUsed.set(base, timesUsed);
  const email = timesUsed === 1 ? `${base}@acme.example` : `${base}${timesUsed}@acme.example`;

  return { fullName: `${first} ${last}`, email };
}

/** The first salary in the local currency, as a whole number rounded to hundreds. */
function startingSalary(
  random: () => number,
  country: CountryCode,
  department: Department,
  level: Level,
): number {
  const [low, high] = LEVEL_BANDS[level];
  const usd =
    randomInt(random, low, high) * COUNTRY_FACTOR[country] * DEPARTMENT_FACTOR[department];
  const rate = USD_PER_UNIT[currencyForCountry(country)];
  return roundToHundreds(usd / rate);
}

/** The first salary, plus (for about 40% of people) one to three raises of 3% to 15%. */
function makeHistory(
  random: () => number,
  employeeId: number,
  hireDate: Date,
  startingAmount: number,
  currency: string,
): SeedChangeRow[] {
  const history: SeedChangeRow[] = [
    {
      employeeId,
      oldAmount: null,
      newAmount: formatAmount(startingAmount),
      currency,
      reason: 'Initial salary',
      changedAt: hireDate,
    },
  ];

  const daysEmployed = daysBetween(hireDate, REFERENCE_DATE);
  const getsRaises = randomInt(random, 1, 100) <= RAISE_PERCENT;
  // Someone hired very recently has not had time for a raise.
  if (!getsRaises || daysEmployed < 90) return history;

  const raiseCount = randomInt(random, 1, 3);
  let amount = startingAmount;

  for (let raise = 1; raise <= raiseCount; raise += 1) {
    const percent = randomInt(random, 3, 15);
    let newAmount = roundToHundreds((amount * (100 + percent)) / 100);
    if (newAmount === amount) newAmount += 100;

    history.push({
      employeeId,
      oldAmount: formatAmount(amount),
      newAmount: formatAmount(newAmount),
      currency,
      reason: pickOne(random, RAISE_REASONS),
      // Raises are spread evenly between the hire date and the reference date.
      changedAt: addDays(hireDate, Math.floor((daysEmployed * raise) / (raiseCount + 1))),
    });
    amount = newAmount;
  }

  return history;
}

const roundToHundreds = (amount: number) => Math.round(amount / 100) * 100;
const formatAmount = (amount: number) => `${amount}.00`;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}
