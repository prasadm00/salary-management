# Decision Log

Short records of what was decided, why, and what was rejected. Newest at the bottom.
Status values: **Accepted** (in force), **Superseded** (replaced by a later entry).

## Summary

| Plan ID | Decision | Entry | Status |
| --- | --- | --- | --- |
| (setup) | Monorepo with npm workspaces | 001 | Accepted |
| D1 | PostgreSQL with Prisma | 002 | Accepted |
| D4 | Group by currency, optional USD view | 003, 007 | 003 superseded by 007 |
| D5 | Free-tier-only deployment, one Render service plus Neon | 004 | Accepted |
| D2 | No login for now | 005 | Accepted |
| D3 | Salary means annual base salary in local currency | 006 | Accepted |
| D4 | Cross-country comparison policy | 007 | Accepted |

---

## 001. Monorepo with npm workspaces
**Status:** Accepted
**Decision:** `api`, `web` and `shared` live in one repository.
**Why:** Types and Zod schemas are shared between UI and API, and reviewers see one history.
**Rejected:** Separate repositories (types would drift, and two histories to read).

## 002. PostgreSQL with Prisma (D1)
**Status:** Accepted
**Decision:** PostgreSQL. Neon online, Docker Compose locally. Prisma for migrations and typed queries.
**Why:** Exact `NUMERIC` type for money, strong aggregation support (median, percentiles), and persistent free hosting.
**Trade-off:** Needs Docker locally and a running database for tests.
**Rejected:** SQLite (no real decimal type, weaker aggregations, and free hosts wipe local disk files).

## 003. Currency policy (first draft)
**Status:** Superseded by 007
**Decision:** Salaries are stored and compared in local currency. Cross-currency views need an explicit, documented policy.
**Why superseded:** The policy is now defined in 007.

## 004. Free-tier-only deployment (D5)
**Status:** Accepted
**Decision:** Neon for the database and one Render web service that serves both the API and the built UI. No paid services.
**Why:** The brief needs a deployed app. One service means one URL and no CORS setup.
**Trade-off:** The free API sleeps when idle, so the first request can take up to a minute.
**Mitigation:** A free uptime pinger on `/api/health`, and a note in the README.
**Rejected:** Render Postgres (the free database expires after about 30 days). Railway and Fly.io (no lasting free tier). Separate Vercel hosting for the UI (adds CORS and a second deployment).

## 005. No login for now (D2)
**Status:** Accepted
**Decision:** The demo is open. No accounts, passwords or sessions.
**Why:** The brief names one persona and does not ask for authentication. It saves time and keeps the focus on salary management and insights.
**Consequences:** Only fictional data may be used. Change history records no user.
**Later:** Adding auth is a contained change (middleware plus an `actor` column on the history table).

## 006. Salary means annual base salary in local currency (D3)
**Status:** Accepted
**Decision:** One salary amount per employee, per year, in the employee's local currency. Money is stored as exact decimals with two places.
**Why:** The brief gives no data for bonus, equity or benefits.
**Rejected:** Total compensation, and pay frequencies such as monthly or hourly (they need hours and period rules we do not have).

## 007. Cross-country comparison policy (D4)
**Status:** Accepted
**Decision:** Statistics are grouped by currency, so different currencies are never averaged together. An optional "show in USD" view uses a fixed rates table kept in the repository, with its "as of" date shown in the UI. The rates are illustrative, not live.
**Why:** The HR manager will want to compare countries, so refusing to answer is not enough. Fixed, dated rates keep results repeatable and honest.
**Trade-off:** The USD figures are approximate and must be labelled that way.
**Rejected:** Live exchange-rate API (adds a dependency, and results change over time). Silent conversion to one currency (hides the assumption).
