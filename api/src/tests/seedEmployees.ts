import type { PrismaClient } from '../db/prisma.js';

export interface SeedEmployee {
  id: number;
  fullName: string;
  email: string;
  department: string;
  level: string;
  country: string;
  status?: 'ACTIVE' | 'INACTIVE';
  hireDate: string;
  /** Annual base salary, for example "2400000.00". */
  amount: string;
  currency: string;
}

/**
 * Inserts employees straight into the test database, with the ids given.
 * Much faster than going through the API, and it lets a test control every value.
 */
export async function seedEmployees(prisma: PrismaClient, rows: SeedEmployee[]): Promise<void> {
  await prisma.employee.createMany({
    data: rows.map((row) => ({
      id: row.id,
      employeeCode: `EMP-${String(row.id).padStart(6, '0')}`,
      fullName: row.fullName,
      email: row.email,
      department: row.department,
      jobTitle: 'Specialist',
      level: row.level,
      country: row.country,
      employmentStatus: row.status ?? 'ACTIVE',
      hireDate: new Date(`${row.hireDate}T00:00:00.000Z`),
    })),
  });
  await prisma.compensation.createMany({
    data: rows.map((row) => ({
      employeeId: row.id,
      amount: row.amount,
      currency: row.currency,
      effectiveDate: new Date(`${row.hireDate}T00:00:00.000Z`),
    })),
  });
}

/**
 * Eight people, small enough to work out every answer by hand.
 *
 * | id | name         | dept        | level | country | status   | hired      | salary          | in USD  |
 * | 1  | Asha Rao     | Engineering | L3    | IN      | ACTIVE   | 2021-04-12 | 2,400,000 INR   | 28,800  |
 * | 2  | Priya Nair   | Engineering | L2    | IN      | ACTIVE   | 2022-06-01 | 1,200,000 INR   | 14,400  |
 * | 3  | Liam Carter  | Sales       | L4    | US      | ACTIVE   | 2019-09-02 |    95,000 USD   | 95,000  |
 * | 4  | Mia Lopez    | Support     | L1    | US      | INACTIVE | 2023-01-10 |    42,000 USD   | 42,000  |
 * | 5  | Hans Müller  | Engineering | L5    | DE      | ACTIVE   | 2018-03-05 |    90,000 EUR   | 97,200  |
 * | 6  | Priyanka Rao | Sales       | L3    | IN      | ACTIVE   | 2020-11-20 | 1,800,000 INR   | 21,600  |
 * | 7  | Sam_Lee      | Support     | L2    | US      | ACTIVE   | 2024-02-02 |    50,000 USD   | 50,000  |
 * | 8  | SamxLee      | Support     | L1    | US      | ACTIVE   | 2017-07-07 |    60,000 USD   | 60,000  |
 *
 * Names 7 and 8 differ only by an underscore, to prove "_" is not a wildcard.
 * USD uses the fixed rates: 1 INR = 0.012 USD, 1 EUR = 1.08 USD.
 */
export const SAMPLE_EMPLOYEES: SeedEmployee[] = [
  {
    id: 1,
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    department: 'Engineering',
    level: 'L3',
    country: 'IN',
    hireDate: '2021-04-12',
    amount: '2400000.00',
    currency: 'INR',
  },
  {
    id: 2,
    fullName: 'Priya Nair',
    email: 'priya.nair@acme.example',
    department: 'Engineering',
    level: 'L2',
    country: 'IN',
    hireDate: '2022-06-01',
    amount: '1200000.00',
    currency: 'INR',
  },
  {
    id: 3,
    fullName: 'Liam Carter',
    email: 'liam.carter@acme.example',
    department: 'Sales',
    level: 'L4',
    country: 'US',
    hireDate: '2019-09-02',
    amount: '95000.00',
    currency: 'USD',
  },
  {
    id: 4,
    fullName: 'Mia Lopez',
    email: 'mia.lopez@acme.example',
    department: 'Support',
    level: 'L1',
    country: 'US',
    status: 'INACTIVE',
    hireDate: '2023-01-10',
    amount: '42000.00',
    currency: 'USD',
  },
  {
    id: 5,
    fullName: 'Hans Müller',
    email: 'hans.mueller@acme.example',
    department: 'Engineering',
    level: 'L5',
    country: 'DE',
    hireDate: '2018-03-05',
    amount: '90000.00',
    currency: 'EUR',
  },
  {
    id: 6,
    fullName: 'Priyanka Rao',
    email: 'priyanka@acme.example',
    department: 'Sales',
    level: 'L3',
    country: 'IN',
    hireDate: '2020-11-20',
    amount: '1800000.00',
    currency: 'INR',
  },
  {
    id: 7,
    fullName: 'Sam_Lee',
    email: 'sam_lee@acme.example',
    department: 'Support',
    level: 'L2',
    country: 'US',
    hireDate: '2024-02-02',
    amount: '50000.00',
    currency: 'USD',
  },
  {
    id: 8,
    fullName: 'SamxLee',
    email: 'samxlee@acme.example',
    department: 'Support',
    level: 'L1',
    country: 'US',
    hireDate: '2017-07-07',
    amount: '60000.00',
    currency: 'USD',
  },
];

/** One test employee with sensible defaults. Override only what a test cares about. */
export function aSeedEmployee(id: number, overrides: Partial<SeedEmployee> = {}): SeedEmployee {
  return {
    id,
    fullName: `Person ${id}`,
    email: `person${id}@acme.example`,
    department: 'Engineering',
    level: 'L1',
    country: 'US',
    hireDate: '2020-01-01',
    amount: '100.00',
    currency: 'USD',
    ...overrides,
  };
}
