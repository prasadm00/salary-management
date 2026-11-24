# API

The API is described once, in `api/src/docs/openapi.ts`. Everything below comes from that file, and a test calls every
endpoint to make sure the description matches the real API.

## Try it

| What | Address |
| --- | --- |
| **Swagger page**: read every endpoint and try it from the browser | `/api/docs` |
| **OpenAPI file**: for Postman, code generators and other tools | `/api/openapi.json` |
| **Postman collection**: one click download, already points at this server | `/api/docs/postman-collection.json` |

Locally that is `http://localhost:4000/api/docs`. After deployment, use your Render address instead.

**Postman:** download the collection, then in Postman choose **Import** and pick the file. Every request is ready, with
example bodies and an `id` value. Optional filters are switched off, so tick the ones you want. To call another server,
change the `baseUrl` collection variable. Postman can also import `/api/openapi.json` directly through **Import > Link**.

## Endpoints

| Method and path | What it does |
| --- | --- |
| `GET /api/health` | Is the service and its database up |
| `GET /api/meta/filters` | Values for the filter lists (countries with currency, departments, levels) |
| `GET /api/employees` | Search, filter, sort and page through employees |
| `POST /api/employees` | Add an employee (currency comes from the country) |
| `GET /api/employees/{id}` | One employee with the current salary |
| `PATCH /api/employees/{id}/status` | Mark active or inactive |
| `PATCH /api/employees/{id}/compensation` | Change the salary, with a reason |
| `GET /api/employees/{id}/compensation-history` | Salary changes for one employee, newest first |
| `GET /api/analytics/summary` | Headcount and statistics, one group per currency |
| `GET /api/analytics/by-country`, `by-department`, `by-level` | Statistics for each group |
| `GET /api/analytics/distribution` | Salary histogram |
| `GET /api/analytics/extremes` | Highest and lowest paid |
| `GET /api/analytics/recent-changes` | Latest salary changes across all employees |

## Rules that apply everywhere
- **Money is text**, such as `"105500.00"`, never a number. Numbers are refused.
- **Currency follows the country** and cannot be chosen.
- **Salary history is never edited.** A change adds a record with its reason.
- **Errors** look like `{ "error": { "code", "message", "details?", "requestId" } }` with the codes
  `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409), `BUSINESS_RULE_VIOLATION` (422) and `INTERNAL_ERROR` (500).
- **Unknown query parameters and unknown body fields are refused** with a 400.
- **No login.** The data is fictional.
- **`view=usd`** converts to US dollars at fixed, illustrative rates. The answer says which date the rates are from.
