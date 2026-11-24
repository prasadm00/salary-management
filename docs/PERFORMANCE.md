# Performance Notes

**Target** (from the requirements): list and statistics calls answer in under **300 ms** with 10,000 employees.

**Result: met.** The slowest API call measured was **47 ms**, about 6 times faster than the target.

All numbers were measured on a developer laptop (Apple silicon, macOS) with PostgreSQL 18 running on the same machine,
using the real seeded data (10,000 employees). They are a snapshot, not a promise. Timings vary by a few milliseconds
between runs. A free host over the internet will be slower, and that has not been measured yet.

## 1. API response times (task 5G.3)

Best of 5 calls, after the server has warmed up. The very first call after a restart is slower (about 100 to 150 ms).

| Call | Time |
| --- | --- |
| `GET /api/employees` (first page) | 27 ms |
| `GET /api/employees?q=priya` (text search) | 11 ms |
| `GET /api/employees?q=emp-0050` (search by code) | 8 ms |
| `GET /api/employees?country=IN&department=Engineering&level=L3` | 8 ms |
| `GET /api/employees?sortBy=salary&currency=INR&sortDir=desc` | 10 ms |
| `GET /api/employees?sortBy=salary&view=usd&pageSize=100` | 31 ms |
| `GET /api/employees?page=400&pageSize=25` (last page) | 38 ms |
| `GET /api/employees/5000` | 3 ms |
| `GET /api/employees/5000/compensation-history` | 4 ms |
| `GET /api/meta/filters` | 25 ms |
| `GET /api/analytics/summary` | 33 ms |
| `GET /api/analytics/summary?view=usd` | 28 ms |
| `GET /api/analytics/by-country` | 37 ms |
| `GET /api/analytics/by-department` | 47 ms |
| `GET /api/analytics/by-level` | 37 ms |
| `GET /api/analytics/distribution?currency=INR` | 12 ms |
| `GET /api/analytics/distribution?view=usd` | 29 ms |
| `GET /api/analytics/extremes?currency=USD` | 4 ms |
| `GET /api/analytics/recent-changes` | 3 ms |

## 2. Why it stays fast

- Searching, sorting, paging and statistics all run **inside PostgreSQL**. The 10,000 rows never travel to the API.
- The list returns at most 100 rows per page.
- Indexes (section 3) cover the filters, sorts and searches people use.
- The exact median is picked from an ordered list of salaries per group. It matched PostgreSQL's own `percentile_cont` on 10,000 rows.

## 3. Index review with EXPLAIN ANALYZE (tasks 5G.1 and 5G.2)

`EXPLAIN ANALYZE` runs a query and shows how PostgreSQL did it and how long it took.
I ran 13 of the main queries twice: **before** (all extra indexes removed, inside a transaction that is rolled back)
and **after** (the indexes we keep). The queries are in `docs/performance/queries.sql`, and the full output
is saved in `docs/performance/explain-results.txt`. To repeat it: `docs/performance/run.sh`.

| Query | Before | After | What changed |
| --- | --- | --- | --- |
| Q01 first page of the list, sorted by name | 5.1 ms | 5.1 ms | Same. Sorts 10,000 names in memory (see section 5). |
| Q02 total count | 2.1 ms | 2.3 ms | Same. Has to count every row. |
| Q03 text search ("priya") | 7.4 ms | **1.0 ms** | Uses the three search indexes instead of reading every row. |
| Q04 filter by country, department and level | 1.0 ms | 0.6 ms | Uses the country and department index. |
| Q05 inactive employees | 1.6 ms | 1.2 ms | Small gain. |
| Q06 newest hires first | 2.7 ms | **0.04 ms** | Reads 25 rows in index order, no sorting. |
| Q07 highest INR salaries | 2.0 ms | **0.06 ms** | Same idea. |
| Q08 one employee | 0.01 ms | 0.01 ms | The primary key already does it. |
| Q09 salary history of one employee | 0.67 ms | **0.008 ms** | Index on employee and date. |
| Q10 latest 10 salary changes | 1.1 ms | **0.04 ms** | Index on date. |
| Q11 statistics per currency | 13.2 ms | 13.5 ms | Same. Reads every salary on purpose. |
| Q12 statistics per department and currency | 17.9 ms | 18.8 ms | Same. |
| Q13 ten highest paid in USD | 2.6 ms | **0.06 ms** | Index on currency and amount. |

**What each index is for**

| Index | Used by |
| --- | --- |
| `idx_employees_full_name_trgm`, `idx_employees_email_trgm`, `idx_employees_code_trgm` | The text search. All three are needed (see below). |
| `idx_employees_country_department` | Filter by country, or country and department |
| `idx_employees_department` | Filter by department alone |
| `idx_employees_level` | Filter by level (used when it picks few people, such as L6) |
| `idx_employees_status` | Filter by inactive |
| `idx_employees_hire_date` | Sort by hire date |
| `idx_compensations_currency_amount` | Sort by salary within one currency, highest and lowest paid |
| `idx_changes_employee_changed_at` | Salary history of one employee |
| `idx_changes_changed_at` | Latest salary changes |

## 4. Two changes made because of the measurements

1. **Added `idx_employees_code_trgm`.** The search looks in name, email and employee code. Name and email had a search index,
   but the code did not. Because of that one column, PostgreSQL ignored all the indexes and read the whole table.
   With the code index added, the same search went from **7.4 ms to 1.0 ms**, about 7 times faster.
2. **Removed `idx_employees_country`.** The `(country, department)` index already serves a filter on country alone.
   With and without the separate index, a country-only query took the same time (about 2.5 ms warm), and PostgreSQL's
   usage counters showed it was used once. One index less to keep up to date.

Both are in the migration `tune_search_indexes`. A test (`api/src/tests/indexes.test.ts`) checks the final set of indexes.

## 5. Things I deliberately did not do

- **No index for the default sort by name** (Q01, 5 ms). It would need an index on `lower(full_name)`. 5 ms is far below the target,
  and each extra index is one more thing to explain and maintain. Worth adding if the data grows a lot.
- **No shortcut for the statistics** (Q11, Q12, 13 to 19 ms). They read every salary because they compute exact figures
  for everyone. At 10,000 rows that is fast. At millions of rows, a summary table would be the next step.
- **At this size most queries are already fast without indexes** (a few milliseconds). The indexes matter most as the data grows,
  and the measurements above show where they help today.

## 6. Seed script (task 5F.4)

Command: `npm run seed -w api`

| Step | Time |
| --- | --- |
| Make 10,000 employees, 10,000 salaries and 17,967 history rows in memory | about 20 ms |
| Save them to PostgreSQL (batches of 1,000) | about 4.5 seconds |
| **Total** | **about 4.6 seconds** |

Three runs in a row: 4,582 ms, 4,592 ms and 4,532 ms. Each run left exactly 10,000 employees, so it is safe to run again.
Rows are saved 1,000 at a time. One insert per row would take many times longer.
Against a remote database (Neon) the save will take longer because of the network. The target is under one minute.

## 7. Test speed

| Part | Time |
| --- | --- |
| Unit tests (rules, schemas, seed generator) | a few seconds in total |
| Database tests (about 800 tests against a real PostgreSQL) | about 10 seconds in total |
| The one test that saves all 10,000 seeded employees | about 4 seconds, which is the real insert time |
