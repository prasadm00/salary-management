# Prompt: Initial project scope

## Input
Write the requirements for a salary management app for ACME Corp. It should let an HR manager:
- See the salaries of 10,000 employees across 10 countries
- Understand how the company pays people: headcount, min/max/median salary by country, department and level
- Change a person's salary with a reason (kept for audit)
- Find people by name, email or code
- Filter by country, department, level, status
- Never mix up currencies

Format as: goal, features in and out, constraints, success criteria.

## Output summary
Defined 3-screen mockup (directory, detail, dashboard), data model with 3 tables (employees, compensation, compensation_history), and API endpoints. All 1,000 employees queries must answer in under 300 ms.

## Key decisions made
- No login (fictional data only)
- Salary history is append-only (never edited)
- One currency per country (not user choice)
- Search in the database (not the browser)
