// The fixed lists and numbers the seed script uses. Everything here is fictional.

import type { CountryCode, Level } from '@acme/shared';

export const SEED = 2026;
export const EMPLOYEE_COUNT = 10_000;

/** "Today" for the seed data. A fixed date, so the data does not change from day to day. */
export const REFERENCE_DATE = new Date('2026-11-01T00:00:00.000Z');
export const FIRST_HIRE_DATE = new Date('2010-01-01T00:00:00.000Z');

export const INACTIVE_PERCENT = 5;
/** Share of employees who got at least one raise. */
export const RAISE_PERCENT = 40;

// How many employees (in %) get each value. Each list adds up to 100.

export const COUNTRY_WEIGHTS: readonly { value: CountryCode; weight: number }[] = [
  { value: 'IN', weight: 25 },
  { value: 'US', weight: 22 },
  { value: 'GB', weight: 10 },
  { value: 'DE', weight: 9 },
  { value: 'CA', weight: 7 },
  { value: 'FR', weight: 6 },
  { value: 'JP', weight: 6 },
  { value: 'AU', weight: 5 },
  { value: 'SG', weight: 5 },
  { value: 'BR', weight: 5 },
];

export const DEPARTMENT_WEIGHTS = [
  { value: 'Engineering', weight: 35 },
  { value: 'Sales', weight: 15 },
  { value: 'Operations', weight: 12 },
  { value: 'Customer Support', weight: 10 },
  { value: 'Marketing', weight: 8 },
  { value: 'Finance', weight: 7 },
  { value: 'HR', weight: 5 },
  { value: 'Product', weight: 5 },
  { value: 'Legal', weight: 3 },
] as const;

export type Department = (typeof DEPARTMENT_WEIGHTS)[number]['value'];

export const LEVEL_WEIGHTS: readonly { value: Level; weight: number }[] = [
  { value: 'L1', weight: 18 },
  { value: 'L2', weight: 27 },
  { value: 'L3', weight: 25 },
  { value: 'L4', weight: 18 },
  { value: 'L5', weight: 8 },
  { value: 'L6', weight: 4 },
];

// Salary rules. A starting salary is worked out in US dollars like this:
//   random amount in the level's band x country factor x department factor
// and then converted to the local currency with the fixed rates.

export const LEVEL_BANDS: Record<Level, [low: number, high: number]> = {
  L1: [30_000, 50_000],
  L2: [45_000, 70_000],
  L3: [65_000, 100_000],
  L4: [90_000, 140_000],
  L5: [130_000, 200_000],
  L6: [190_000, 300_000],
};

export const COUNTRY_FACTOR: Record<CountryCode, number> = {
  US: 1.0,
  CA: 0.9,
  DE: 0.85,
  AU: 0.85,
  SG: 0.85,
  GB: 0.8,
  FR: 0.78,
  JP: 0.7,
  BR: 0.35,
  IN: 0.3,
};

export const DEPARTMENT_FACTOR: Record<Department, number> = {
  Engineering: 1.1,
  Product: 1.1,
  Legal: 1.05,
  Sales: 1.0,
  Finance: 1.0,
  Marketing: 0.95,
  Operations: 0.9,
  HR: 0.9,
  'Customer Support': 0.8,
};

// Job titles. L1 to L5 add a word to the role. L6 is "Head of <department>".

export const ROLE_BY_DEPARTMENT: Record<Department, string> = {
  Engineering: 'Engineer',
  Sales: 'Sales Executive',
  Operations: 'Operations Analyst',
  'Customer Support': 'Support Specialist',
  Marketing: 'Marketing Specialist',
  Finance: 'Finance Analyst',
  HR: 'HR Partner',
  Product: 'Product Manager',
  Legal: 'Legal Counsel',
};

export const TITLE_PREFIX: Record<Exclude<Level, 'L6'>, string> = {
  L1: 'Associate ',
  L2: '',
  L3: 'Senior ',
  L4: 'Lead ',
  L5: 'Principal ',
};

export const RAISE_REASONS = ['Annual review', 'Promotion', 'Market adjustment'] as const;

// Names. Each country uses the name list of its region.

interface NameList {
  first: string[];
  last: string[];
}

const INDIAN: NameList = {
  first: [
    'Asha',
    'Priya',
    'Rahul',
    'Arjun',
    'Neha',
    'Vikram',
    'Anita',
    'Sanjay',
    'Kavya',
    'Rohan',
    'Meera',
    'Amit',
  ],
  last: [
    'Rao',
    'Nair',
    'Sharma',
    'Iyer',
    'Patel',
    'Gupta',
    'Reddy',
    'Menon',
    'Singh',
    'Das',
    'Kapoor',
    'Joshi',
  ],
};

const ENGLISH: NameList = {
  first: [
    'Liam',
    'Emma',
    'Noah',
    'Olivia',
    'James',
    'Sophia',
    'Lucas',
    'Grace',
    'Henry',
    'Chloe',
    'Jack',
    'Ruby',
  ],
  last: [
    'Carter',
    'Smith',
    'Brown',
    'Taylor',
    'Wilson',
    'Clark',
    'Walker',
    'Hall',
    'Young',
    'King',
    'Wright',
    'Scott',
  ],
};

const EUROPEAN: NameList = {
  first: [
    'Hans',
    'Anna',
    'Lukas',
    'Marie',
    'Pierre',
    'Claire',
    'Felix',
    'Sofia',
    'Jonas',
    'Elena',
    'Louis',
    'Nina',
  ],
  last: [
    'Mueller',
    'Schmidt',
    'Weber',
    'Dubois',
    'Martin',
    'Bernard',
    'Fischer',
    'Moreau',
    'Wagner',
    'Laurent',
    'Becker',
    'Petit',
  ],
};

const JAPANESE: NameList = {
  first: [
    'Hiroshi',
    'Yuki',
    'Takeshi',
    'Aiko',
    'Kenji',
    'Sakura',
    'Daiki',
    'Mei',
    'Ren',
    'Hana',
    'Sota',
    'Emi',
  ],
  last: [
    'Tanaka',
    'Sato',
    'Suzuki',
    'Takahashi',
    'Watanabe',
    'Ito',
    'Yamamoto',
    'Nakamura',
    'Kobayashi',
    'Kato',
    'Yoshida',
    'Hayashi',
  ],
};

const BRAZILIAN: NameList = {
  first: [
    'Mateus',
    'Camila',
    'Gabriel',
    'Beatriz',
    'Pedro',
    'Julia',
    'Thiago',
    'Larissa',
    'Bruno',
    'Mia',
    'Rafael',
    'Lucia',
  ],
  last: [
    'Silva',
    'Santos',
    'Oliveira',
    'Souza',
    'Lopez',
    'Costa',
    'Pereira',
    'Almeida',
    'Ribeiro',
    'Gomes',
    'Lima',
    'Rocha',
  ],
};

export const NAMES_BY_COUNTRY: Record<CountryCode, NameList> = {
  IN: INDIAN,
  US: ENGLISH,
  GB: ENGLISH,
  CA: ENGLISH,
  AU: ENGLISH,
  SG: ENGLISH,
  DE: EUROPEAN,
  FR: EUROPEAN,
  JP: JAPANESE,
  BR: BRAZILIAN,
};
