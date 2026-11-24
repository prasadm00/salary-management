# API Contract

The agreement between the React app and the Express API. Tests and code are written against this file.
Related: [Data model](LLD.md) · [User stories](USER_STORIES.md) · [Design](DESIGN.md)

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base path | `/api`. No version prefix (single client, deployed together). |
| Format | JSON in and out. `Content-Type: application/json`. |
| Authentication | None for now (decision 005). |
| Names | JSON fields are `camelCase`. Query parameters are `camelCase`. |
| Money | A **string** with exactly two decimals, for example `"2400000.00"`. Never a JSON number, so no floating-point rounding. On input, strings matching `^\d{1,12}(\.\d{1,2})?$` are accepted. Numbers are rejected. |
| Currency | ISO 4217 code, for example `"INR"`. |
| Country | ISO 3166-1 alpha-2 code, for example `"IN"`. |
| Dates | `YYYY-MM-DD`. Timestamps are ISO 8601 in UTC, for example `"2026-11-23T09:30:00.000Z"`. |
| IDs | `id` is an integer. `employeeCode` is a readable string such as `"EMP-000001"`. |
| Unknown query parameters | Rejected with `400`, so typos are caught early. |
| Request ID | Every response has an `X-Request-Id` header, which is also in error bodies. |

### 1.1 Standard paged response

```json
{
  "data": [ ],
  "page": 1,
  "pageSize": 25,
  "total": 10000
}
```

`total` is the number of matching records, not the number on this page. `page` starts at 1. A page past the end returns `data: []` with the correct `total`.

### 1.2 Standard error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "details": [
      { "field": "amount", "message": "Amount must have at most two decimal places." }
    ],
    "requestId": "b1c2d3e4"
  }
}
```

`details` is present only when there is field-level information. `message` is written for a non-technical reader. Stack traces and database messages are never returned.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Malformed or invalid input (bad field, bad query value, unknown parameter) |
| 404 | `NOT_FOUND` | Employee or route does not exist |
| 409 | `CONFLICT` | Duplicate email or employee code |
| 422 | `BUSINESS_RULE_VIOLATION` | Input is well-formed but breaks a salary rule (for example the amount did not change) |
| 500 | `INTERNAL_ERROR` | Unexpected failure. Details are logged, not returned. |
| 503 | `SERVICE_UNAVAILABLE` | Database not reachable (health check only) |

### 1.3 Shared objects

**Employee**
```json
{
  "id": 1,
  "employeeCode": "EMP-000001",
  "fullName": "Asha Rao",
  "email": "asha.rao@acme.example",
  "department": "Engineering",
  "jobTitle": "Software Engineer",
  "level": "L3",
  "country": "IN",
  "employmentStatus": "ACTIVE",
  "hireDate": "2021-04-12",
  "compensation": {
    "amount": "2400000.00",
    "currency": "INR",
    "effectiveDate": "2025-04-01"
  },
  "createdAt": "2026-11-23T09:00:00.000Z",
  "updatedAt": "2026-11-23T09:00:00.000Z"
}
```

**Compensation change**
```json
{
  "id": 2,
  "employeeId": 1,
  "oldAmount": "2000000.00",
  "newAmount": "2400000.00",
  "currency": "INR",
  "reason": "Annual review 2025",
  "changedAt": "2025-04-01T00:00:00.000Z"
}
```
`oldAmount` is `null` for the starting salary.

### 1.4 Shared analytics filters

Every `/api/analytics/*` endpoint accepts these.

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `country` | `IN`, `US`, ... | all | Must be a known country code |
| `department` | string | all | |
| `level` | `L1` to `L6` | all | |
| `status` | `ACTIVE`, `INACTIVE`, `ALL` | `ACTIVE` | Default counts only active employees (US-10 AC3) |
| `view` | `local`, `usd` | `local` | `usd` converts using the fixed rates table and labels the result (US-13) |

**Local view** returns one row per currency, so currencies are never combined.
**USD view** returns amounts in USD and adds `ratesAsOf` and `ratesNote` to the response. Conversion happens in full precision and is rounded to two decimals only at the end.

---

## 2. Employees

### 2.1 `GET /api/employees`: list, search, filter, sort, page
Stories: US-01 to US-04.

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `q` | string | none | 1 to 100 characters. Case-insensitive "contains" match on name, email or employee code. |
| `country` | country code | all | |
| `department` | string | all | |
| `level` | `L1` to `L6` | all | |
| `status` | `ACTIVE`, `INACTIVE` | all | Omit to include both |
| `currency` | ISO code | all | Needed for salary sorting (see below) |
| `sortBy` | `fullName`, `employeeCode`, `salary`, `hireDate`, `department`, `country`, `level` | `fullName` | Allow-list only |
| `sortDir` | `asc`, `desc` | `asc` | |
| `view` | `local`, `usd` | `local` | With `usd`, `sortBy=salary` sorts on the USD equivalent |
| `page` | integer ≥ 1 | `1` | |
| `pageSize` | integer 1 to 100 | `25` | Over 100 gives `400` |

**Salary sorting rule.** Comparing raw amounts across currencies is meaningless (10,000 INR is not 10,000 USD). So `sortBy=salary` is accepted only when the results are in one currency (`currency` is given) or when `view=usd`. Otherwise the API returns `400` with the message "Choose a currency or switch to the USD view to sort by salary."

**Order is stable.** Every sort ends with `id` as a tie-breaker, so paging never repeats or skips a person.

**Example**
```
GET /api/employees?q=pri&country=IN&sortBy=hireDate&sortDir=desc&page=1&pageSize=25
```
```json
{
  "data": [ { "id": 77, "employeeCode": "EMP-000077", "fullName": "Priya Nair", "...": "Employee object" } ],
  "page": 1,
  "pageSize": 25,
  "total": 14
}
```

| Status | When |
| --- | --- |
| 200 | Success, including an empty result |
| 400 | Bad parameter, unknown parameter, `pageSize` > 100, salary sort across currencies |

### 2.2 `GET /api/employees/:id`: one employee
Story: US-05.

Returns an **Employee** object. `404 NOT_FOUND` if the id does not exist. `400` if `:id` is not a positive integer.

### 2.3 `POST /api/employees`: create an employee
Story: US-06.

**Body**
```json
{
  "fullName": "Asha Rao",
  "email": "asha.rao@acme.example",
  "department": "Engineering",
  "jobTitle": "Software Engineer",
  "level": "L3",
  "country": "IN",
  "hireDate": "2021-04-12",
  "salary": "2000000.00"
}
```

| Field | Rule |
| --- | --- |
| `fullName` | Required, 1 to 120 characters, trimmed |
| `email` | Required, valid email, up to 160 characters. Stored in lower case. |
| `department`, `jobTitle` | Required, 1 to 60 and 1 to 80 characters |
| `level` | Required, `L1` to `L6` |
| `country` | Required, a known country code |
| `hireDate` | Required, a real date, not in the future |
| `salary` | Required money string, greater than zero |

The server sets `employeeCode` (next in sequence), `employmentStatus` (`ACTIVE`) and the **currency** from the country. The client cannot send a currency. The employee, the current compensation and the starting history row (`oldAmount: null`, reason `"Initial salary"`) are saved in one transaction.

| Status | Body | When |
| --- | --- | --- |
| 201 | **Employee**, with a `Location: /api/employees/:id` header | Created |
| 400 | `VALIDATION_ERROR` with `details` | Invalid input |
| 409 | `CONFLICT` | Email already used |

### 2.4 `PATCH /api/employees/:id/compensation`: change a salary
Story: US-07.

**Body**
```json
{ "amount": "2400000.00", "reason": "Annual review 2025" }
```

| Field | Rule |
| --- | --- |
| `amount` | Required money string, greater than zero, at most two decimals |
| `reason` | Required, 3 to 255 characters, trimmed |

The currency cannot be changed here. The effective date is set to today (server date). In one transaction, the compensation is updated and a history row is added.

| Status | Body | When |
| --- | --- | --- |
| 200 | Updated **Employee** | Changed |
| 400 | `VALIDATION_ERROR` | Missing reason, bad amount, extra fields |
| 404 | `NOT_FOUND` | Unknown employee |
| 422 | `BUSINESS_RULE_VIOLATION` with a `details` item `{ "field": "amount", "message": "The new amount is the same as the current amount." }` | Amount did not change |

### 2.5 `PATCH /api/employees/:id/status`: activate or deactivate
Story: US-09. *(Added to the endpoint list from the plan; needed for US-09.)*

**Body**
```json
{ "status": "INACTIVE" }
```
`status` is `ACTIVE` or `INACTIVE`. Returns the updated **Employee** (200). Setting the same status again is allowed and changes nothing. There is no `DELETE` endpoint.

### 2.6 `GET /api/employees/:id/compensation-history`: salary history
Story: US-08.

Query: `page` (default 1), `pageSize` (1 to 100, default 25). Returns the standard paged response of **Compensation change** objects, newest first (`changedAt` descending, then `id` descending).

`404` if the employee does not exist. History is read-only: there is no endpoint to edit or delete it.

---

## 3. Analytics

All analytics endpoints use the filters in section 1.4. All are `GET`, return `200`, and return `400` for invalid parameters.

### 3.1 `GET /api/analytics/summary`: overall headcount and statistics
Stories: US-10, US-11.

**Local view example**
```json
{
  "view": "local",
  "headcount": 9400,
  "groups": [
    {
      "currency": "INR",
      "headcount": 2100,
      "min": "480000.00", "max": "9800000.00",
      "average": "2315400.55", "median": "2100000.00",
      "p25": "1200000.00", "p75": "3100000.00"
    },
    { "currency": "USD", "headcount": 1500, "min": "...", "max": "...", "average": "...", "median": "...", "p25": "...", "p75": "..." }
  ]
}
```

**USD view example** (one group, plus a label)
```json
{
  "view": "usd",
  "ratesAsOf": "2026-01-01",
  "ratesNote": "Fixed, illustrative exchange rates. Not live market data.",
  "headcount": 9400,
  "groups": [ { "currency": "USD", "headcount": 9400, "min": "...", "max": "...", "average": "...", "median": "...", "p25": "...", "p75": "..." } ]
}
```

`headcount` at the top is the number of employees matching the filters. In local view it equals the sum of the group headcounts.

### 3.2 `GET /api/analytics/by-country`, `/by-department`, `/by-level`
Stories: US-10, US-11.

Same filters. Returns one row per group **and currency**.

```json
{
  "view": "local",
  "groupBy": "department",
  "headcount": 9400,
  "rows": [
    { "key": "Engineering", "currency": "INR", "headcount": 820,
      "min": "...", "max": "...", "average": "...", "median": "...", "p25": "...", "p75": "..." },
    { "key": "Engineering", "currency": "USD", "headcount": 610,
      "min": "...", "max": "...", "average": "...", "median": "...", "p25": "...", "p75": "..." }
  ]
}
```

- For `by-country`, `key` is the country code and each country has one currency.
- For `by-department` and `by-level`, a group with people paid in several currencies has one row per currency. This is how the API avoids mixing currencies.
- In USD view there is one row per group, with `currency: "USD"` and the label fields from section 3.1.
- Groups with no employees are not returned. Rows are ordered by `key`, then `currency`.

### 3.3 `GET /api/analytics/distribution`: salary spread
Story: US-12.

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `currency` | ISO code | none | Required when `view=local`. Ignored when `view=usd`. |
| `buckets` | integer 5 to 30 | `10` | Number of equal-width ranges |
| plus the shared filters | | | |

```json
{
  "view": "local",
  "currency": "INR",
  "headcount": 2100,
  "min": "480000.00",
  "max": "9800000.00",
  "buckets": [
    { "from": "480000.00",  "to": "1412000.00", "count": 410 },
    { "from": "1412000.00", "to": "2344000.00", "count": 702 }
  ]
}
```

Buckets are equal width, cover `min` to `max`, and each employee is in exactly one bucket. A range includes its `from` and excludes its `to`, except the last, which includes `max`. The counts add up to `headcount`. If nobody matches, `buckets` is `[]`.

### 3.4 `GET /api/analytics/extremes`: highest and lowest paid
Story: US-14.

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `currency` | ISO code | none | Required when `view=local` |
| `limit` | integer 1 to 25 | `10` | |
| plus the shared filters | | | |

```json
{
  "view": "local",
  "currency": "USD",
  "top":    [ { "id": 5, "employeeCode": "EMP-000005", "fullName": "Liam Carter", "department": "Sales", "level": "L6", "country": "US", "amount": "310000.00" } ],
  "bottom": [ { "id": 9, "employeeCode": "EMP-000009", "fullName": "Mia Lopez", "department": "Support", "level": "L1", "country": "US", "amount": "42000.00" } ]
}
```
`top` is highest first and `bottom` is lowest first. Ties are ordered by `id`.

### 3.5 `GET /api/analytics/recent-changes`: latest salary changes
Story: US-14. *(Added to the endpoint list from the plan; needed for US-14.)*

Query: `limit` (1 to 25, default 10). Does not use the other filters.

```json
{
  "data": [
    {
      "id": 4021,
      "employee": { "id": 1, "employeeCode": "EMP-000001", "fullName": "Asha Rao" },
      "oldAmount": "2000000.00", "newAmount": "2400000.00",
      "currency": "INR", "reason": "Annual review 2025",
      "changedAt": "2025-04-01T00:00:00.000Z"
    }
  ]
}
```
Newest first. The starting-salary rows (`oldAmount: null`) are excluded, because they are not changes.

---

## 4. Meta and health

### 4.1 `GET /api/meta/filters`: options for dropdowns
Story: US-03 AC4. The values come from the data (departments) and from the shared reference data (countries, currencies).

```json
{
  "countries": [ { "code": "IN", "name": "India", "currency": "INR" } ],
  "currencies": ["AUD", "BRL", "CAD", "EUR", "GBP", "INR", "JPY", "SGD", "USD"],
  "departments": ["Engineering", "Finance", "HR", "Sales"],
  "levels": ["L1", "L2", "L3", "L4", "L5", "L6"],
  "statuses": ["ACTIVE", "INACTIVE"],
  "ratesAsOf": "2026-01-01"
}
```
Countries and departments are listed only if at least one employee has them. Sorted alphabetically.

### 4.2 `GET /api/health`: readiness
Used by the free uptime pinger and by Render. Does not expose secrets or versions of dependencies.

```json
{ "status": "ok", "database": "up", "uptimeSeconds": 1234 }
```
Returns `503` with `{ "status": "degraded", "database": "down" }` when the database cannot be reached. The check is a lightweight `SELECT 1`.

---

## 5. Endpoint summary

| Method | Path | Purpose | Story |
| --- | --- | --- | --- |
| GET | `/api/employees` | List, search, filter, sort, page | US-01 to US-04 |
| GET | `/api/employees/:id` | One employee | US-05 |
| POST | `/api/employees` | Create | US-06 |
| PATCH | `/api/employees/:id/compensation` | Change salary | US-07 |
| PATCH | `/api/employees/:id/status` | Activate or deactivate | US-09 |
| GET | `/api/employees/:id/compensation-history` | Salary history | US-08 |
| GET | `/api/analytics/summary` | Headcount and statistics | US-10, US-11 |
| GET | `/api/analytics/by-country` | Statistics per country | US-10, US-11 |
| GET | `/api/analytics/by-department` | Statistics per department | US-10, US-11 |
| GET | `/api/analytics/by-level` | Statistics per level | US-10, US-11 |
| GET | `/api/analytics/distribution` | Salary histogram | US-12 |
| GET | `/api/analytics/extremes` | Top and bottom paid | US-14 |
| GET | `/api/analytics/recent-changes` | Latest salary changes | US-14 |
| GET | `/api/meta/filters` | Dropdown options | US-03 |
| GET | `/api/health` | Readiness | US-16, US-17 |

US-13 (USD view) is served by the `view=usd` parameter on the employees and analytics endpoints. US-15 (seed) is a script, not an endpoint.

## 6. Changes from the task plan
These keep every user story covered.

1. **Added** `PATCH /api/employees/:id/status` (US-09) and `GET /api/analytics/recent-changes` (US-14). The plan had no endpoint for either.
2. **Added** `GET /api/analytics/extremes` (US-14), which the plan listed only as "top and bottom paid".
3. **Salary sorting** needs a single currency or the USD view, so it never compares different currencies. This refines US-04 AC1, which is updated to match.
4. **Added** a `currency` filter on the employee list, needed for point 3.
5. **Added** `requestId` to error bodies, matching the observability goal in the design document.
