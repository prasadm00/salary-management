# ACME Salary Management

Web software for an HR manager to manage salaries for 10,000 employees across countries and to answer how the organisation pays people.

> Status: scaffolding. Features are added in small, test-first commits.

## Documentation
- [Project overview](docs/PROJECT_OVERVIEW.md)
- Requirements (one page): `docs/REQUIREMENTS.md` (coming next)
- Design and trade-offs: `docs/DESIGN.md` (planned)
- AI usage log: [AI_USAGE.md](AI_USAGE.md)

## Layout
| Path | Purpose |
| --- | --- |
| `api/` | Node + TypeScript + Express API, Prisma, seed script |
| `web/` | React + TypeScript + Vite UI |
| `shared/` | Types and Zod schemas used by both sides |
| `docs/` | Requirements, design, decisions, performance notes, prompts |

## Local setup (will be completed as the code lands)
```bash
cp .env.example .env
docker compose up -d         # local PostgreSQL (or use any PostgreSQL 14+ you already run)
npm install
npm run db:generate -w api   # generate the Prisma client
npm run db:migrate -w api    # create the tables in salary_management
npm run check                # lint, format check, type-check, tests
npm run dev -w api           # API on http://localhost:4000
```

**Using your own PostgreSQL instead of Docker.** Create the role and two databases once:

```sql
CREATE ROLE acme LOGIN PASSWORD 'acme' CREATEDB;
CREATE DATABASE salary_management OWNER acme;
CREATE DATABASE salary_management_test OWNER acme;   -- the tests wipe this one
```

The tests apply migrations to `salary_management_test` themselves. They refuse to run against any database whose name does not end in `_test`.

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run lint:fix` | ESLint (strict, type-aware) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run db:generate -w api`, `db:migrate`, `db:deploy` | Generate the Prisma client, create a migration, apply migrations |
| `npm run typecheck` | `tsc --noEmit` in every workspace (strict mode) |
| `npm test` | Vitest in every workspace |
| `npm run test:coverage` | Tests with a coverage summary |
| `npm run check` | Everything CI runs, in one command |

A pre-commit hook (Husky + lint-staged) lints and formats staged files. It is enabled by `npm install`.

## Branching and commits
- `main` is always deployable. Work happens on short-lived branches (`feat/`, `fix/`, `chore/`, `docs/`, `test/`) merged with `--no-ff`.
- Conventional Commits. Behaviour changes start with a failing test commit, then the code commit.
