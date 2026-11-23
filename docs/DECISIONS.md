# Decision Log

Short records of choices and why. Newest at the bottom.

## 001. Monorepo with npm workspaces
`api`, `web`, and `shared` live in one repo so types and Zod schemas are shared and reviewers see one history.

## 002. PostgreSQL with Prisma
Exact `NUMERIC` for money, strong aggregation support (median, percentiles), and persistent hosting. Local database runs via Docker Compose.

## 003. Currency policy
Salaries are stored and compared in local currency. Cross-currency views need an explicit, documented conversion policy. To be finalised in `REQUIREMENTS.md`.

## 004. Free-tier-only deployment
Neon (database) and one Render web service that serves both the API and the built UI. No paid services. Trade-off: the free API sleeps when idle, so the first request can be slow. Mitigation: a free uptime pinger on `/api/health` and a README note.

## 005. No login for now
The brief names one persona (the HR manager) and does not ask for authentication. The demo is open. Left out deliberately: it saves time and keeps the focus on salary management and insights. Consequence: the app must not be given real data, and change history records no user. Adding auth later is a contained change (middleware plus an `actor` column on history).

## 006. Salary means annual base salary in local currency
Total compensation (bonus, equity, benefits) is out of scope because the brief gives no data for it.

## 007. Cross-country comparison
Statistics are grouped by currency by default, so different currencies are never averaged together. An optional "show in USD" view uses a fixed rates table kept in the repo with its "as of" date shown in the UI. The rates are illustrative, not live.
