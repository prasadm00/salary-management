# Requirements: ACME Salary Management

## Goal
ACME's HR team manages salary data for 10,000 employees in several countries using Excel files, which is slow and error-prone. Build a web application where the HR manager can find and update salaries, and can answer "how does the organisation pay people?" by country, department and level.

## User
**HR manager** (single persona). Works on a laptop, needs answers quickly, and is not technical.

## In scope
1. **Employee directory:** search by name, email or employee code. Filter by country, department, level and status. Sort. Server-side pagination across 10,000 records.
2. **Employee profile:** role, department, level, country, hire date, current annual base salary and currency.
3. **Add employee** with an initial salary.
4. **Update salary** with a required reason. Every change is kept as history (old amount, new amount, reason, time).
5. **Salary insights dashboard:** headcount, and minimum, maximum, average and median salary by country, department and level. Salary distribution chart. Highest and lowest paid. Recent changes.
6. **Seed script** that creates 10,000 fictional employees, repeatably.
7. **Deployed, free-hosted** application, plus a short demo video.

## Deliberately left out, and why
| Left out | Reason |
| --- | --- |
| Login and user accounts | The brief names one persona and does not ask for it. Saves time. Can be added later without redesign. |
| Payroll, tax, benefits, bonuses, equity | Needs country-specific rules and data we do not have. "Salary" here means annual base salary. |
| Live currency conversion | No rate source or date policy was given. Live rates would make results change over time. |
| Excel/CSV import and export | Seeded data covers the demo. It is a good next step, not core to the problem. |
| Natural-language AI questions | Filters and a dashboard answer the common questions reliably. An AI layer adds risk on sensitive pay data. |
| Roles and permissions, approvals, multi-tenancy | One persona, one organisation. |
| Deleting employees | Pay history must not be lost. Employees can be marked inactive instead. |

## Assumptions
- **D1:** PostgreSQL (Neon online, Docker locally).
- **D2:** No login for now. Data is fictional only.
- **D3:** Salary is annual base salary in the employee's local currency. Money is stored as exact decimals.
- **D4:** Different currencies are never averaged together. Results are grouped by currency. An optional "show in USD" view uses a fixed rates table with a visible "as of" date. The rates are illustrative.
- **D5:** One free Render service serves the API and the UI, with a free Neon database. The first load after idle may be slow.

## Success criteria
- The HR manager finds any employee in under 10 seconds and updates their salary, and the change appears in history.
- List and dashboard calls respond in under 300 ms on 10,000 records.
- No total or average ever mixes currencies unless the USD view is switched on and labelled.
- The seed creates exactly 10,000 employees, and running it twice gives the same data.
- Core rules are covered by fast, deterministic automated tests that pass in CI.
- The application is live at a public URL, with the repository, design documents and demo video available to the reviewers.
