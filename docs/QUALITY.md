# Quality Report (Phase 7)

Checked on 2026-11-24 against the seeded database (10,000 employees).

## 7.1 Tests, lint and types
`npm run check` passes: lint, formatting, TypeScript strict mode and **1,006 tests** (12 shared, 789 API, 205 web).
CI runs the same command, plus the web build, against a real PostgreSQL container.

## 7.2 Coverage
| Area | Lines | Target |
| --- | --- | --- |
| API overall | 98.7% | 85% |
| `domain/` (money, currency, salary rules) | 100% | 95% |
| Services (employees, compensation, analytics) | 95% to 100% | 90% |
| Web overall | 97.7% | 70% |

The few uncovered lines are defensive branches that cannot happen through the API, such as "an employee row has no salary".
Run `npm run test:coverage` for the full report.

## 7.3 End-to-end smoke test
`node docs/qa/smoke.mjs` drives a real browser against the seeded data: open the dashboard, search for "rao", open a person,
change their salary with a reason, see the new salary and history entry, then see that change in the dashboard's recent changes.
It passes with no browser console errors. It changes one salary, so run `npm run seed -w api` afterwards to reset the data.

## 7.4 Security review
| Check | Result |
| --- | --- |
| Input validation on every endpoint | Every route that takes input checks it with a Zod schema (body, URL parameters and query string). Unknown query parameters and unknown body fields are refused. |
| Hostile requests, tried against the running API | 18 attempts: SQL text in the search box and in `sortBy`, an id of `1 OR 1=1`, huge page sizes, repeated parameters, malformed JSON, a body over 100 kB, a salary sent as a number, a client choosing its own currency, XML instead of JSON, `DELETE`, and editing history. 15 were refused with 400, 2 with 404 (no such route), and the SQL text in the search box was searched for as plain text and matched nothing (200). None caused a 500, and no data changed. |
| SQL injection | Values are always sent as parameters. The sort column comes from a fixed allow-list in code, and request text never becomes SQL. Text typed in search is escaped so `%` and `_` are plain characters. |
| CORS | Only the configured origin is allowed. The server never echoes another site's origin, so the browser blocks other sites. |
| Response headers | Helmet sets Content-Security-Policy, HSTS, `X-Content-Type-Options`, `X-Frame-Options` and others. `X-Powered-By` is off. |
| Error messages | A test proves a database failure returns a generic message, with no stack trace and no internal detail. Each error carries a request id for support. |
| Request size | JSON bodies are limited to 100 kB. Page sizes are limited to 100. |
| Secrets | No tokens or keys in the repository or its history. The only tracked env file is `.env.example`. The only passwords in the repo are the local-only `acme:acme` for development and tests. `.env` is ignored by git. |
| Destructive actions | The seed script refuses to run on a remote database without `SEED_CONFIRM=yes`. Tests refuse to run on a database whose name does not end in `_test`. There is no delete endpoint, and salary history cannot be edited. |
| Dependency audit | `npm audit --omit=dev` (code that ships): **0 vulnerabilities**. See below for the rest. |

### Dependency audit details
- **`effect` (high, a regular-expression slowdown).** It sits inside Prisma's command-line configuration loader, and our app never gives it user input. The fixed version 3.22.5 is forced with an npm `overrides` entry in the root `package.json`. Prisma migrations, the client and all tests were run afterwards and work. `npm ls` shows a harmless note that the version differs from the one Prisma asked for.
- **`shadcn` (4 moderate, in `minimatch`).** This is the command-line tool that copies UI components into the project. It was listed as a runtime dependency, which is wrong, so it is now a dev dependency. It is not part of the built app. `npm audit fix` would downgrade it to version 1, so it was not applied.
- Remaining `npm audit` output (all dependencies, including tools): 4 moderate findings, all in the `shadcn` tool chain.

### Known limits (deliberate, see Decisions)
- **No login** (decision 005). Anyone who can reach the address can read and change data, so the demo must only hold fictional data.
- **No rate limiting.** Not needed for a single-user demo. It would be the first addition if real users were added.
- The Content-Security-Policy suits the JSON API. When Express also serves the web app (Phase 9), it must be checked again.

## 7.5 Placeholder files
The nine `.gitkeep` files in folders that now have code are removed. `docs/prompts` keeps its one, because it is still empty.

## 7.6 Readability pass
No TODO or FIXME comments, no `any` casts, no `@ts-ignore`, and no debug output (the seed command prints on purpose).
No source file is longer than 290 lines, and the longest are a list of names and one documented SQL repository.
