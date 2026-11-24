# Performance Notes

Target (from the requirements): list and statistics calls answer in **under 300 ms** with 10,000 employees.

All numbers below were measured on a developer laptop (Apple silicon, macOS) with PostgreSQL 18 running locally,
on the real seeded data (10,000 employees). They are a snapshot, not a promise. Hosted free tiers will be slower.
The index review (`EXPLAIN ANALYZE`) is still to do and will be added here (task 5G).

## 1. Seed script (task 5F.4)

Command: `npm run seed -w api`

| Step | Time |
| --- | --- |
| Make 10,000 employees, 10,000 salaries and 17,967 history rows in memory | about 20 ms |
| Save them to PostgreSQL (batches of 1,000) | about 4.5 seconds |
| **Total** | **about 4.6 seconds** |

Three runs in a row: 4,582 ms, 4,592 ms and 4,532 ms. Each run left exactly 10,000 employees, so it is safe to run again.

Why it is fast enough: rows are saved 1,000 at a time. One insert per row would take many times longer.
Against a remote database (Neon) the save step will take longer because of network round trips. The target is under one minute.

## 2. API response times on 10,000 employees

Best of 5 calls, after the server has warmed up. The very first call after a restart is slower (about 100 to 150 ms).

| Call | Time |
| --- | --- |
| `GET /api/employees` (first page) | 25 ms |
| `GET /api/employees?q=priya` (text search) | 31 ms |
| `GET /api/employees?country=IN&department=Engineering&level=L3` | 8 ms |
| `GET /api/employees?sortBy=salary&currency=INR&sortDir=desc` | 13 ms |
| `GET /api/employees?sortBy=salary&view=usd&pageSize=100` | 26 ms |
| `GET /api/employees?page=400&pageSize=25` (last page) | 41 ms |
| `GET /api/employees/5000` | 3 ms |
| `GET /api/employees/5000/compensation-history` | 5 ms |
| `GET /api/meta/filters` | 13 ms |
| `GET /api/analytics/summary` | 16 ms |
| `GET /api/analytics/summary?view=usd` | 11 ms |
| `GET /api/analytics/by-country` | 37 ms |
| `GET /api/analytics/by-department` | 34 ms |
| `GET /api/analytics/by-level` | 36 ms |
| `GET /api/analytics/distribution?currency=INR` | 11 ms |
| `GET /api/analytics/distribution?view=usd` | 26 ms |
| `GET /api/analytics/extremes?currency=USD` | 3 ms |
| `GET /api/analytics/recent-changes` | 4 ms |

The slowest call is 41 ms, far below the 300 ms target.

## 3. Why it stays fast

- Searching, sorting, paging and statistics all run **inside PostgreSQL**. The 10,000 rows never travel to the API.
- The list returns at most 100 rows per page.
- Indexes exist for the filters people use (country, department, level, status, currency and amount) and for name and email search (`pg_trgm`).
- The exact median is picked from an ordered list of salaries per group. It matched PostgreSQL's own `percentile_cont` on 10,000 rows.

## 4. Test speed

| Part | Time |
| --- | --- |
| Unit tests (rules, schemas, seed generator) | a few seconds in total |
| Database tests (about 700 tests against a real PostgreSQL) | about 10 seconds in total |
| The one test that saves all 10,000 seeded employees | about 4 seconds, which is the real insert time |
