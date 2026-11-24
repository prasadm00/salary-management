#!/bin/sh
# Compares query plans with and without our indexes. Needs the database to be seeded first:
#   npm run seed -w api
# Usage: docs/performance/run.sh > docs/performance/explain-results.txt

DATABASE_URL="${DATABASE_URL:-postgresql://acme:acme@localhost:5432/salary_management}"
cd "$(dirname "$0")" || exit 1
psql "$DATABASE_URL" --quiet --file compare.sql
