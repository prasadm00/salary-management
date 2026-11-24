# Tasks Plan: ACME Salary Management

This is the master plan, start to end. Tick each box as work finishes. Phases run in order. Design comes before code.

**How to read it**
- Every task has a **branch**, a **suggested commit message**, and a **done when** check.
- Commits are small. Behaviour changes use test-first: one commit for the failing test, one for the code that makes it pass.
- All hosting is free (see Phase 9).

## Decisions (LOCKED)

| # | Question | Decision |
| --- | --- | --- |
| D1 | Database | PostgreSQL (Neon in production, Docker locally) |
| D2 | Login | None for now. Open demo, listed as "left out" with reasons |
| D3 | Salary meaning | Annual base salary in local currency |
| D4 | Cross-country comparison | Group by currency by default, plus an optional "show in USD" view using a fixed, dated rates table in the repo |
| D5 | Deployment shape | One Render service serving API and built UI, plus Neon. All free tiers |

---

## Phase 0. Repository setup (DONE)
- [x] Repo created, `main` pushed, personal git identity set
- [x] Project overview written (`docs/PROJECT_OVERVIEW.md`)
- [x] Monorepo skeleton: `api/`, `web/`, `shared/`, `docs/`
- [x] README, AI usage log, decision log, `.gitignore`, `.env.example`, `docker-compose.yml`

---

## Phase 1. Requirements (one page)
**Branch:** `docs/requirements`

- [x] **1.1** Write `docs/REQUIREMENTS.md`, one page, with these sections:
  - Goal (one paragraph)
  - Users: HR manager
  - In scope (features list)
  - Deliberately left out, with a reason for each
  - Assumptions (D1 to D5)
  - Success criteria (what "done" looks like)
  - Commit: `docs: add one-page requirements`
  - Done when: it fits on one page and answers goal, scope, exclusions, reasons.
- [x] **1.2** Write user stories with acceptance criteria in `docs/USER_STORIES.md`. Examples:
  - As an HR manager I can search employees by name or ID.
  - As an HR manager I can see salary statistics by country.
  - Commit: `docs: add user stories and acceptance criteria`
- [x] **1.3** Update `docs/DECISIONS.md` with D1 to D5 and the free-hosting rule
  - Commit: `docs: record decisions on stack, currency, and hosting`

---

## Phase 2. High-level design (HLD)
**Branch:** `docs/hld`

All diagrams use Mermaid so they render on GitHub. Put them in `docs/DESIGN.md` or `docs/diagrams/`.

- [x] **2.1** System context diagram: HR manager, web app, API, database
- [x] **2.2** Container diagram: browser UI, Express API, PostgreSQL, hosting (Render, Neon)
- [x] **2.3** Deployment diagram: how code gets from GitHub to live
- [x] **2.4** Main user flow diagram: browse, search, view, edit salary, dashboard
- [x] **2.5** Technology choices with trade-offs table (why Postgres, Prisma, Express, Vite, Tailwind/shadcn, Recharts, Vitest)
- [x] **2.6** Non-functional requirements: performance target (list page under 300 ms for 10,000 rows), correctness (decimal money), security basics, accessibility basics
  - Commit: `docs: add high-level design with context, container, and deployment diagrams`
  - Done when: someone new can explain the system from the diagrams alone.

---

## Phase 3. Low-level design (LLD)
**Branch:** `docs/lld`

- [x] **3.1** ER diagram and table definitions
  - `employees`: id, employee_code (unique), full_name, email (unique), department, job_title, level, country, employment_status, hire_date
  - `compensations`: employee_id (unique FK), amount (NUMERIC 14,2), currency (ISO 4217), effective_date
  - `compensation_changes` (history): id, employee_id, old_amount, new_amount, currency, reason, changed_at
  - `fx_rates` or a constants file: currency, rate_to_usd, as_of_date (only if D4 uses conversion)
  - Index list: employee_code, country, department, level, full_name search, `(country, department)`
- [x] **3.2** API contract: `docs/API.md` (OpenAPI is optional)
  - `GET /api/employees` with query: `q`, `country`, `department`, `level`, `status`, `sortBy`, `sortDir`, `page`, `pageSize` (max 100)
  - `GET /api/employees/:id`
  - `POST /api/employees`
  - `PATCH /api/employees/:id/compensation` (body: amount, reason)
  - `GET /api/employees/:id/compensation-history`
  - `GET /api/analytics/summary`, `.../by-country`, `.../by-department`, `.../by-level`, `.../distribution`
  - `GET /api/meta/filters` (countries, departments, levels for dropdowns)
  - `GET /api/health`
  - Standard error shape: `{ error: { code, message, details? } }`
  - Standard paged response: `{ data, page, pageSize, total }`
- [x] **3.3** Sequence diagrams: list with filters, update salary (with history write in one transaction), analytics query
- [x] **3.4** Backend module design: route, controller, service, repository per module; what each layer may and may not do
- [x] **3.5** Domain rules (each becomes a test): amount must be positive, max two decimals, currency must match country, new amount must differ from old, reason is required, no float arithmetic, median calculated in the database
- [x] **3.6** Frontend design: page list, routes, component tree, state approach (React Query for server state), screen wireframes (simple sketches)
- [x] **3.7** Seed design: seeded random generator, country to currency map, salary bands per level and country, realistic name and department lists, batch size 1,000, expected runtime
- [x] **3.8** Test strategy: pyramid, what is unit, what is HTTP-level, how the test database works, naming conventions, coverage target (core domain 90%+)
  - Commit: `docs: add low-level design (schema, API, sequences, rules, test strategy)`

---

## Phase 4. Tooling and foundations
**Branch:** `chore/tooling`

- [ ] **4.1** TypeScript base config and strict mode in each workspace. Commit: `chore: add strict typescript config`
- [ ] **4.2** ESLint and Prettier, with `npm run lint`. Commit: `chore: add eslint and prettier`
- [ ] **4.3** Vitest in `api`, `web`, `shared`, with a trivial passing test. Commit: `chore: add vitest to all workspaces`
- [ ] **4.4** GitHub Actions workflow: install, lint, test on push and PR. Commit: `chore: add ci workflow`
- [ ] **4.5** Optional: Husky and lint-staged for pre-commit checks

---

## Phase 5. Backend (test-first)
Every item follows red, green, refactor. Each is its own branch, merged with `--no-ff`.

### 5A. Foundation. Branch `feat/api-foundation`
- [ ] **5A.1** Express app, `app.ts` (no listen) and `server.ts`. Test: `GET /api/health` returns 200.
- [ ] **5A.2** Env config with Zod. Test: missing `DATABASE_URL` throws a clear error.
- [ ] **5A.3** Error-handling middleware with the standard error shape. Tests: validation error gives 400, unknown route gives 404, unexpected error gives 500 without leaking details.
- [ ] **5A.4** Prisma schema and first migration from Phase 3.1. Commit: `feat(api): add prisma schema and initial migration`
- [ ] **5A.5** Test database helper (separate DB or transaction per test). Done when tests run fast and independently.

### 5B. Money and domain rules. Branch `feat/domain-money`
- [ ] **5B.1** `Money` value object. Tests: rejects negative and zero, rejects more than two decimals, no floating-point drift, formats with currency.
- [ ] **5B.2** Currency and country mapping. Tests: valid pair accepted, mismatch rejected.
- [ ] **5B.3** Salary change rule. Tests: same amount rejected, missing reason rejected.

### 5C. Employees. Branch `feat/employees`
- [ ] **5C.1** Create employee. Tests: valid input, duplicate code or email gives 409, bad input gives 400.
- [ ] **5C.2** Get employee by id. Tests: found, not found gives 404.
- [ ] **5C.3** Update compensation with history in one transaction. Tests: history row created, old and new amounts stored, failure rolls back both.
- [ ] **5C.4** Compensation history endpoint. Tests: newest first.
- [ ] **5C.5** Optional: deactivate employee (status change, never hard delete)

### 5D. Search, filter, sort, pagination. Branch `feat/employee-search`
- [ ] **5D.1** Pagination. Tests: default page size, max 100, page beyond end returns empty list with correct total.
- [ ] **5D.2** Filters by country, department, level, status. Tests: each alone and combined.
- [ ] **5D.3** Text search by name, email, or code. Tests: case-insensitive, partial match.
- [ ] **5D.4** Sorting with an allow-list of columns. Tests: unknown column rejected (prevents injection through sort).
- [ ] **5D.5** Filter options endpoint for dropdowns.

### 5E. Analytics. Branch `feat/analytics`
- [ ] **5E.1** Headcount by country, department, level
- [ ] **5E.2** Salary stats per currency: min, max, average, median, p25, p75. Tests with small hand-checked datasets.
- [ ] **5E.3** Stats grouped by country, department, level, with the same filters as the list
- [ ] **5E.4** Salary distribution buckets (histogram) within one currency
- [ ] **5E.5** Optional USD view using the dated rates table (D4), clearly labelled with its date
- [ ] **5E.6** Top and bottom paid, recently changed salaries

### 5F. Seed. Branch `feat/seed-10k`
- [ ] **5F.1** Deterministic generator. Test: same seed gives identical output.
- [ ] **5F.2** Seed script with batch inserts. Test: creates exactly 10,000 employees with unique codes and emails, and amounts inside the bands.
- [ ] **5F.3** Idempotent: re-running clears and re-seeds, or skips
- [ ] **5F.4** Measure seed time and record it in `docs/PERFORMANCE.md`

### 5G. Performance. Branch `chore/performance`
- [ ] **5G.1** Add indexes from Phase 3.1
- [ ] **5G.2** Run `EXPLAIN ANALYZE` on list and analytics queries. Save before and after results.
- [ ] **5G.3** Record results and the 300 ms target check in `docs/PERFORMANCE.md`

---

## Phase 6. Frontend
**Branch per item.** Component tests focus on behaviour, not styling.

- [ ] **6.1** Vite + React + TypeScript + Tailwind + shadcn/ui setup, app shell, navigation, routing (`feat/web-foundation`)
- [ ] **6.2** Typed API client using shared types, React Query setup, shared error and loading components
- [ ] **6.3** Employee directory (`feat/web-directory`): table with server-side paging, sort, filters, debounced search, URL-synced query params, empty and error states
- [ ] **6.4** Employee detail page: profile, current compensation, history timeline
- [ ] **6.5** Edit salary dialog: validation messages, reason field, success and error feedback
- [ ] **6.6** Add employee form
- [ ] **6.7** Dashboard (`feat/web-dashboard`): headcount cards, salary stats by country, department, level, distribution chart, a clear currency label on every number
- [ ] **6.8** Accessibility pass: labels, focus order, keyboard use, contrast
- [ ] **6.9** Responsive pass for laptop and tablet widths
- [ ] **6.10** Frontend tests: filter changes call the API with the right params, salary form validation, dashboard renders currency groups

---

## Phase 7. Quality gate
**Branch:** `chore/quality`

- [ ] **7.1** All tests green, lint clean, TypeScript has no errors
- [ ] **7.2** Coverage report. Core domain and services at 90% or higher.
- [ ] **7.3** One end-to-end smoke run against the seeded database: search, edit salary, check dashboard
- [ ] **7.4** Security review: input validation on every endpoint, sort allow-list, CORS locked, no secrets in repo, dependency audit (`npm audit`)
- [ ] **7.5** Remove all `.gitkeep` files in folders that now have content
- [ ] **7.6** Code readability pass: clear names, short functions, comments that explain why, not what

---

## Phase 8. Documentation (parallel with everything, finish here)
- [ ] **8.1** `README.md`: what it is, live URL, demo video link, setup in five commands, test commands, folder map
- [ ] **8.2** `docs/DESIGN.md` final: diagrams match the built system
- [ ] **8.3** `docs/API.md` final
- [ ] **8.4** `docs/PERFORMANCE.md` final
- [ ] **8.5** `docs/DECISIONS.md` final, with trade-offs and what I'd do next
- [ ] **8.6** `AI_USAGE.md` final: tools used, example prompts, what AI got wrong, what I changed
- [ ] **8.7** `docs/prompts/`: key prompts saved as files
- [ ] **8.8** `docs/DEPLOYMENT.md`: step-by-step so anyone can redeploy

---

## Phase 9. Free deployment
**Branch:** `chore/deploy`

- [ ] **9.1** Create Neon project, copy the connection string
- [ ] **9.2** Express serves the built UI as static files, with SPA fallback
- [ ] **9.3** `render.yaml` or manual Render web service: build, migrate, start commands, environment variables
- [ ] **9.4** Run migrations and the seed against Neon from the local machine
- [ ] **9.5** Verify live: health, list, search, salary edit, dashboard
- [ ] **9.6** Free uptime pinger on `/api/health` and a README note about a slow first load
- [ ] **9.7** Optional: deploy workflow on push to `main`

---

## Phase 10. Demo and submission
- [ ] **10.1** Write a demo script (3 to 5 minutes): problem, requirements, design, live walk-through, tests, AI workflow, trade-offs
- [ ] **10.2** Record the video and upload it (YouTube unlisted or Loom). Add the link to the README.
- [ ] **10.3** Final checklist:
  - [ ] Repo public or reviewers added
  - [ ] Commit history is incremental and readable
  - [ ] One-page requirements present
  - [ ] HLD, LLD, diagrams present
  - [ ] Seed script creates 10,000 employees
  - [ ] Tests pass in CI
  - [ ] Live URL works from a private browser window
  - [ ] Video link works
  - [ ] AI usage and prompts included
  - [ ] No secrets or real personal data in the repo
  - [ ] Token used earlier is revoked
- [ ] **10.4** Reply to the email with the repo link, live URL, video link, and a short summary
- [ ] **10.5** Interview prep: be ready to explain the money handling, currency decision, pagination approach, index choices, transaction for history, and what you'd improve next

---

## Time estimate

| Phase | Effort |
| --- | --- |
| 1 to 3 (docs and design) | 3 to 4 hours |
| 4 (tooling) | 1 hour |
| 5 (backend) | 6 to 8 hours |
| 6 (frontend) | 6 to 8 hours |
| 7 to 8 (quality, docs) | 2 to 3 hours |
| 9 (deploy) | 1 to 2 hours |
| 10 (video, submit) | 1 to 2 hours |

About 2 focused days. The email prefers speed, so keep the optional items for last.

## Cut list if time runs short
Cut in this order: USD conversion view, deactivate employee, Husky, deploy workflow, responsive pass. Never cut: requirements, HLD/LLD, TDD history, seed, deployment, video, AI usage notes.

## Suggested commit messages (quick reference)
`docs:` documents · `chore:` tooling and config · `test:` failing test first · `feat(api):` or `feat(web):` new behaviour · `refactor:` no behaviour change · `fix:` bug fix · `perf:` speed
