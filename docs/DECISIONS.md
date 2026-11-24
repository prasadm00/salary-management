# Decisions and trade-offs

## 001: Monorepo vs. separate repositories

**Decision:** One monorepo with npm workspaces (api, web, shared).

**Why:** A single lint, type-check and test run covers everything. Shared types are easier to keep in sync. The build is one command.

**What I'd do differently:** This is the right call for a small project with two codebases that always ship together.

---

## 002: Express + PostgreSQL vs. other stacks

**Decision:** Node + Express + PostgreSQL + React.

**Why:** Fast to build, familiar, good library ecosystem. PostgreSQL is free, battle-tested, and the data is relational. Express is simple and handles JSON well.

**Other options considered:**
- Python/Django: slower to write for the size of this project.
- Rust: faster at runtime, slower to develop in.
- GraphQL: adds complexity that the app doesn't need (simple CRUD and analytics, no deeply nested data).

---

## 003: Storing salary history (versioning)

**Decision:** Append-only. Each salary change creates a new compensation row. The old row stays. A separate `compensation_history` table records who changed what and when.

**Why:** You can see when salaries changed and by how much. You can't accidentally lose history. It's simpler than trying to merge change batches or store diffs.

**Trade-off:** A little more data in the database (each change gets two rows, plus audit info). Worth it for safety.

---

## 004: Currency locking

**Decision:** The API determines currency from the country. The client doesn't choose it.

**Why:** Prevents mistakes, like adding a 50,000 USD salary to someone in India (should be INR). One rule, enforced everywhere.

**What would break this:** If the company decided to pay people in multiple currencies (e.g., an India-based contractor paid in USD). Then you'd need to let the user choose.

---

## 005: No authentication

**Decision:** Anyone who reaches the URL can read and edit all salary data. No login.

**Why:** The demo holds fictional data, so it's safe. It keeps the first version simple. Authentication is a lot of code (tokens, password hashing, session management, password resets) and would have delayed the project.

**If real users were added:** Authentication would be the first addition. Then role-based access (only HR can edit, managers can read their department). Then audit logging (who changed what, when).

---

## 006: Search strategy

**Decision:** Search happens in PostgreSQL (like `LIKE %search%`), not in the browser or Elasticsearch.

**Why:** With 10,000 rows, downloading all of them and filtering in JavaScript is wasteful. The database search is fast and always exact.

**Trade-off:** A substring search doesn't rank results (a name starting with the search text isn't ranked higher than one with it in the middle). That's fine for this tool.

**If the app scaled:** A full-text search index would handle typos and ranking better.

---

## 007: Caching strategy

**Decision:** No caching headers (Cache-Control, ETags). Each page load fetches fresh data.

**Why:** Salary data changes often. A manager needs to see the latest number. The overhead of cache invalidation isn't worth it for a single-user tool.

**If traffic grew:** Add Redis for the analytics queries (by-country, by-department stats), which change less often.

---

## 008: UI framework choice

**Decision:** React, not Vue or Svelte.

**Why:** The team is familiar with it. The ecosystem is larger (React Query for data fetching, shadcn for components). Vite makes it fast.

**Trade-off:** A smaller framework like Svelte would be faster to build, but React's ecosystem wins here.

---

## 009: State management

**Decision:** React Query for server data, plain React `useState` for form state, URL parameters for page state (filters, sort).

**Why:** Separates concerns. React Query handles fetching and caching. The form state is local and simple. The URL parameters mean you can link to a filtered view, and the Back button works.

**What I didn't use:** Redux or Zustand. They would add complexity without solving a problem here.

---

## 010: Component library

**Decision:** shadcn/ui. The components are copied into the project (not npm packages).

**Why:** Pre-built accessible components that match a design system. Copying means you can customize them without waiting for a new release.

**Trade-off:** Updates to the library require re-copying. We live with that.

---

## 011: Testing strategy

**Decision:** Unit tests for logic, integration tests for the API (against a real test database), UI tests with a fake fetch.

**Why:** Covers the most important paths. The database tests catch SQL mistakes. The UI tests let you verify "did the page ask for the right data?"

**What we don't do:** E2E tests in CI (too slow). We do them manually in Phase 7 (the smoke test).

---

## 012: Deployment target

**Decision:** Render (for the app server) + Neon (for the database). Both free tiers.

**Why:** No DevOps work. Render watches the GitHub repo and deploys on `main`. Neon gives you a PostgreSQL database with a URL.

**Trade-off:** A free app server is slow and sleeps after 15 minutes of inactivity. For a demo, that's fine. For real users, you'd pay for auto-scaling.

---

## 013: Analytics queries

**Decision:** One SQL query per analytics endpoint. For example, to get stats by country, one `SELECT country, COUNT(*), MIN(salary), etc. GROUP BY country`.

**Why:** Fast. All the grouping and math happens in PostgreSQL. The API just returns the result.

**Alternative:** Fetch all 10,000 employee records and compute stats in JavaScript. That's slow and uses a lot of memory.

---

## 014: Salary dialog

**Decision:** A modal that traps focus. Keyboard users can't Tab out of it. Escape closes it.

**Why:** Standard UI pattern. The shadcn dialog component does this automatically.

**What was considered:** A side panel (drawer). It would be wider and show more context, but adds complexity.

---

## What I'd do next (if continuing)

1. **Soft deletes for employees.** Instead of removing a row, set a flag. That way you can query history even after an employee is "deleted."

2. **Bulk import.** Upload a CSV, validate it, and add 100 employees at once. This is the most-requested feature for real HR tools.

3. **Compensation plans.** Templates: "India engineers start at 50,000 INR, 60,000 if L2, 75,000 if L3." Auto-fill the salary based on country and level.

4. **Multi-tenancy.** Each company has its own data. The browser doesn't see another company's salaries.

5. **Scheduled jobs.** At the start of each year, apply a cost-of-living adjustment (e.g., add 5% to all salaries in India).

6. **Graphs.** How has the median salary changed over the last 12 months? Which departments have the highest turnover?

7. **Notifications.** Email a summary: "5 people got promoted this month, costing $500k extra."

8. **Export.** Download the employee list or stats as a CSV or PDF.

9. **Role-based access.** Managers see their department. HR sees everything. Finance sees only costs.

10. **Audit log.** A report of who changed what, when. For compliance.
