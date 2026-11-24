# Prompt: Database schema

## Input
Design a PostgreSQL schema for 10,000 employees across 10 countries. Store:
- Employee: code, name, email, department, job title, level, country, status (ACTIVE/INACTIVE), hire date
- Compensation: salary amount, currency, effective date
- Compensation history: previous amount, new amount, reason, effective date, created date

Each country has one currency. Salary history is append-only (never edited). Include indices for filtering and sorting. Write Prisma schema too.

## Output summary
3 tables + reference tables (countries, currencies, departments, levels). Indices on the query fields. Prisma schema matches.

## Key decisions made
- `employee_code` is unique (businesses use this, not id)
- Compensation is not nested in employee; it's a separate table
- Indices are single-column (not composite) for simplicity
- Hire date is `DATE`, not `TIMESTAMP` (only the day matters)
