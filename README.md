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
docker compose up -d      # local PostgreSQL
npm install
npm test
```

## Branching and commits
- `main` is always deployable. Work happens on short-lived branches (`feat/`, `fix/`, `chore/`, `docs/`, `test/`) merged with `--no-ff`.
- Conventional Commits. Behaviour changes start with a failing test commit, then the code commit.
