# Prompt: API endpoint design

## Input
Design the REST API for a salary app. Endpoints needed:
- List employees with filters (search, country, department, level, status, currency)
- Pagination and sorting
- Get one employee (profile + salary history)
- Change salary (with reason)
- Analytics: headcount by currency, stats by country (headcount, min/median/max salary)
- Get the available values for filters (countries, departments, levels)

For each endpoint, write: method and path, query/body parameters, response shape, validation rules.

## Output summary
19 endpoints covering employees, compensation, analytics and metadata. All use Zod schemas for validation. Errors are structured: `{ error: { code, message } }`.

## Key decisions made
- Use Zod schemas in Express routes
- Validation happens before the service layer
- Sort column comes from a fixed allow-list (no arbitrary SQL)
- Request bodies are limited to 100 kB
