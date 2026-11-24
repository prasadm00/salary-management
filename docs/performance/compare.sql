-- Runs every query twice: with the indexes as they are now (AFTER),
-- and with all extra indexes removed (BEFORE).
-- Nothing is changed for good: the indexes are only removed inside a transaction that is rolled back.

\set ON_ERROR_STOP on

-- Make sure PostgreSQL knows how big the tables are.
ANALYZE employees;
ANALYZE compensations;
ANALYZE compensation_changes;

-- A first run to warm the cache. Its output is thrown away.
\o /dev/null
\i queries.sql
\o

\echo '=================== AFTER: with our indexes ==================='
\i queries.sql

BEGIN;
DROP INDEX idx_employees_department;
DROP INDEX idx_employees_level;
DROP INDEX idx_employees_country_department;
DROP INDEX idx_employees_status;
DROP INDEX idx_employees_hire_date;
DROP INDEX idx_employees_full_name_trgm;
DROP INDEX idx_employees_email_trgm;
DROP INDEX idx_employees_code_trgm;
DROP INDEX idx_compensations_currency_amount;
DROP INDEX idx_changes_employee_changed_at;
DROP INDEX idx_changes_changed_at;

\o /dev/null
\i queries.sql
\o

\echo
\echo '=================== BEFORE: without the extra indexes ==================='
\i queries.sql
ROLLBACK;
