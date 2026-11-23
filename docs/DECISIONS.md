# Decision Log

Short records of choices and why. Newest at the bottom.

## 001. Monorepo with npm workspaces
`api`, `web`, and `shared` live in one repo so types and Zod schemas are shared and reviewers see one history.

## 002. PostgreSQL with Prisma
Exact `NUMERIC` for money, strong aggregation support (median, percentiles), and persistent hosting. Local database runs via Docker Compose.

## 003. Currency policy
Salaries are stored and compared in local currency. Cross-currency views need an explicit, documented conversion policy. To be finalised in `REQUIREMENTS.md`.
