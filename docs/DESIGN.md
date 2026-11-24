# Design

## Architecture

One Express API (Node + TypeScript) and one React web app (Vite + TypeScript), both built from the same monorepo and deployed together.
They share types and reference data via `shared/`.
In development, they run on separate ports (4000 and 5173); Vite forwards `/api` calls.
In production, Express serves both: `/api/*` routes answer the API, `/*` serves the web app.

```
┌─ Express (API + static web app)
│  ├─ /api/employees
│  ├─ /api/analytics
│  ├─ /api/meta
│  └─ /* (serves index.html, the web app)
│
├─ React app (browser)
│  ├─ Dashboard (headcount, stats by country/dept/level, chart)
│  ├─ Employees (search, filter, sort, page, 10,000 rows)
│  ├─ Employee detail (profile, salary, history)
│  ├─ Add employee (form, sets currency from country)
│  └─ Salary dialog (change with reason, validation)
│
└─ PostgreSQL (10,000 employees, normalized schema)
   ├─ employees (code, name, email, dept, job title, level, country, status)
   ├─ compensation (salary by currency, history with dates and reasons)
   ├─ compensation_history (audit trail)
   └─ indices (employee_code, country, department, level, etc.)
```

## Data flow

**List employees:**
1. Browser sends `GET /api/employees?country=IN&search=rao&sortBy=salary&page=2&pageSize=25`
2. API validates all parameters against a Zod schema
3. Database query with Prisma joins employees + their latest compensation, filters and sorts
4. Result is 25 rows with employee code, name, dept, level, country, hire date, and current salary
5. Browser renders a table, filters stay in the URL for sharing/back button

**Change salary:**
1. Browser sends `PATCH /api/employees/:id/compensation` with `{ amount: "105500", reason: "Promotion" }`
2. API validates the amount (required, non-negative, different from current)
3. Database inserts a new compensation row (not an update), keeping the old one for history
4. API returns the new salary with its `effectiveDate`
5. Browser updates the page and shows the new salary + a new history entry

**Analytics:**
Database computes statistics in a single query: headcount, min/median/max salary by country, department, level, and currency.
The chart uses the same data to show salary distribution in ranges.

## Decisions in the design

| What | Why |
| --- | --- |
| PostgreSQL | Relational data, complex queries, proven, free tier available. The salary history is an audit trail: append-only, never edited. |
| Prisma | Type-safe queries, easy migrations, generates the TypeScript types. `findUnique` by code is faster than by id. |
| Express + JSON only | Simple, familiar. No server-side rendering, no websockets. The UI is a single-page app. |
| React + React Query | Fetches data, caches it, refetches on tab focus, retries on network error. The page filters live in the URL, not the state. |
| Tailwind + shadcn/ui | Pre-built components, consistent design system. The components are copied into the project (not npm packages), so they can be customized. |
| No authentication | Deliberate. The demo runs fictional data, so anyone can read and edit it. If real users were added, authentication would be first. |
| No caching headers | Deliberate. Salary data changes often. Each page load fetches fresh data from the server. |
| Search in the database, not the browser | The app lists 10,000 employees. Fetching all of them and filtering in JavaScript would be slow and use a lot of memory. The database search is fast and always exact. |
| Salary history is append-only | Never edited or deleted. Changes are part of the audit trail. If a salary was entered wrong, a new correction entry is added, not an edit. |
| Currency is determined by country | The UI doesn't let you pick a currency; the API sets it from the country. This prevents mixed currency mistakes (e.g., adding a 50,000 USD salary to someone in INR). |
| "US dollars (approximate)" view | Shows conversions at a fixed date, with the date clearly labelled. It's not real-time and uses illustrative rates. |

## Schema

```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  department VARCHAR NOT NULL,
  job_title VARCHAR NOT NULL,
  level VARCHAR NOT NULL REFERENCES level_enum(value),
  country VARCHAR NOT NULL REFERENCES country_enum(value),
  employment_status VARCHAR DEFAULT 'ACTIVE',
  hired_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE compensation (
  id SERIAL PRIMARY KEY,
  employee_id BIGINT REFERENCES employees(id),
  amount DECIMAL(13,2) NOT NULL,
  currency VARCHAR NOT NULL REFERENCES currency_enum(value),
  effective_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE compensation_history (
  id SERIAL PRIMARY KEY,
  employee_id BIGINT REFERENCES employees(id),
  previous_amount DECIMAL(13,2),
  new_amount DECIMAL(13,2) NOT NULL,
  currency VARCHAR NOT NULL,
  reason VARCHAR,
  effective_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_employees_country ON employees(country);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_level ON employees(level);
CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_compensation_employee ON compensation(employee_id);
CREATE INDEX idx_compensation_currency ON compensation(currency);
```

## Screens

**Dashboard:** headcount per currency, then one card per currency with the min/median/max salary. Below that, a table of statistics by country (or department or level). A histogram shows salary distribution. The highest and lowest paid employees (5 each). And the latest 10 salary changes.

**Employees:** a search box, filters for country/dept/level/status/currency. A sortable table of 25 employees per page. Names link to the employee page. The search waits 300 ms after the last key press.

**Employee detail:** profile card with name, code, dept, job title, level, country, hire date, and status. Current salary and an "Update salary" button. A "Mark inactive" or "Mark active" button. And a list of salary changes with dates and reasons.

**Add employee:** form for name, email, dept, job title, level, country, hire date and salary. The country dropdown picks the currency. Submit or cancel. On success, opens the new employee's page.

**Salary dialog:** "New amount" in the employee's currency, "Reason" text field. Submit or cancel. If the new amount is the same as the current one, or the form is empty, messages appear next to the fields. The dialog traps focus (Tab stays inside), Escape closes it, and focus returns to the button that opened it.

## Mobile

On phone width (390 px), the employees table hides the employee code, level, country and hire date. The department appears under the name in gray text. The salary stays. Tables are keyboard-reachable regions that scroll sideways.

On tablet (820 px), all columns show, but horizontal scrolling is still possible.

## Performance

The database has indices on the fields used in WHERE, JOIN and ORDER BY clauses. Statistics queries run as a single SQL statement, not multiple queries. The app doesn't cache salary data, because it changes often. React Query re-fetches on tab focus (so a stale browser tab updates when you switch back).

See `docs/PERFORMANCE.md` for measured response times.

## Testing strategy

- Unit tests for money, currency, validation, and formatting rules.
- API tests that run against a real PostgreSQL test database (which is wiped before each test run).
- UI tests that drive React components with a fake `fetch` function, so the test can see the exact requests the page made.
- Accessibility tests run inside the test suite (axe rules, except colour contrast) and in a real browser (`npm run qa`).

See `docs/QUALITY.md` for coverage numbers.

## What I'd do next

1. **Rate limiting** (if real users were added).
2. **Soft deletes** for employees (a flag instead of removing the row).
3. **Bulk upload** (import a CSV of employees).
4. **Compensation plans** (a template that sets new employees' salary based on level and country).
5. **Notifications** (email a summary of salary changes).
6. **Multi-tenancy** (separate data for each company).
7. **Graphs of salary trends** (how the median has changed over time).
8. **Export** (download the employee list or statistics as a CSV).
9. **Scheduled jobs** (e.g., annual cost-of-living adjustments).
10. **Replication** (read replicas for heavy analytics queries).
