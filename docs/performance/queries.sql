-- The main queries the API runs, written out with sample values.
-- Each one is run with EXPLAIN ANALYZE, which runs the query and shows how PostgreSQL did it.
-- Run everything with: docs/performance/run.sh

\qecho
\qecho '--- Q01 list: first page, sorted by name'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id FROM employees e JOIN compensations c ON c.employee_id = e.id
ORDER BY lower(e.full_name), e.id LIMIT 25;

\qecho
\qecho '--- Q02 list: total count'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT count(*) FROM employees e JOIN compensations c ON c.employee_id = e.id;

\qecho
\qecho '--- Q03 search: name, email or code contains "priya"'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id FROM employees e JOIN compensations c ON c.employee_id = e.id
WHERE e.full_name ILIKE '%priya%' OR e.email ILIKE '%priya%' OR e.employee_code ILIKE '%priya%'
ORDER BY lower(e.full_name), e.id LIMIT 25;

\qecho
\qecho '--- Q04 filter: country + department + level'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id FROM employees e JOIN compensations c ON c.employee_id = e.id
WHERE e.country = 'IN' AND e.department = 'Engineering' AND e.level = 'L3'
ORDER BY lower(e.full_name), e.id LIMIT 25;

\qecho
\qecho '--- Q05 filter: inactive employees only'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id FROM employees e JOIN compensations c ON c.employee_id = e.id
WHERE e.employment_status = 'INACTIVE'
ORDER BY lower(e.full_name), e.id LIMIT 25;

\qecho
\qecho '--- Q06 sort: newest hires first'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id FROM employees e JOIN compensations c ON c.employee_id = e.id
ORDER BY e.hire_date DESC, e.id LIMIT 25;

\qecho
\qecho '--- Q07 sort: highest INR salaries first'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id FROM employees e JOIN compensations c ON c.employee_id = e.id
WHERE c.currency = 'INR'
ORDER BY c.amount DESC, e.id LIMIT 25;

\qecho
\qecho '--- Q08 one employee with their salary'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT * FROM employees e LEFT JOIN compensations c ON c.employee_id = e.id WHERE e.id = 5000;

\qecho
\qecho '--- Q09 salary history of one employee, newest first'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT * FROM compensation_changes WHERE employee_id = 5000
ORDER BY changed_at DESC, id DESC LIMIT 25;

\qecho
\qecho '--- Q10 latest 10 salary changes'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT * FROM compensation_changes WHERE old_amount IS NOT NULL
ORDER BY changed_at DESC, id DESC LIMIT 10;

\qecho
\qecho '--- Q11 analytics: statistics per currency (summary)'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT g.currency, g.n, round(g.lowest, 2), round(g.highest, 2), round(g.mean, 2),
       round((g.a[(g.n + 1) / 2] + g.a[(g.n + 2) / 2]) / 2, 2)
FROM (
  SELECT c.currency::text AS currency, count(*)::int AS n, min(c.amount) AS lowest,
         max(c.amount) AS highest, avg(c.amount) AS mean, array_agg(c.amount ORDER BY c.amount) AS a
  FROM employees e JOIN compensations c ON c.employee_id = e.id
  WHERE e.employment_status = 'ACTIVE'
  GROUP BY 1
) g;

\qecho
\qecho '--- Q12 analytics: statistics per department and currency'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT g.key, g.currency, g.n, round(g.lowest, 2), round(g.highest, 2), round(g.mean, 2),
       round((g.a[(g.n + 1) / 2] + g.a[(g.n + 2) / 2]) / 2, 2)
FROM (
  SELECT e.department::text AS key, c.currency::text AS currency, count(*)::int AS n,
         min(c.amount) AS lowest, max(c.amount) AS highest, avg(c.amount) AS mean,
         array_agg(c.amount ORDER BY c.amount) AS a
  FROM employees e JOIN compensations c ON c.employee_id = e.id
  WHERE e.employment_status = 'ACTIVE'
  GROUP BY 1, 2
) g
ORDER BY lower(g.key), g.currency;

\qecho
\qecho '--- Q13 analytics: ten highest paid in USD'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT e.id, round(c.amount, 2) FROM employees e JOIN compensations c ON c.employee_id = e.id
WHERE c.currency = 'USD' AND e.employment_status = 'ACTIVE'
ORDER BY c.amount DESC, e.id LIMIT 10;
