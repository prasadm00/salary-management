# API Reference

Base URL: `/api` (or the full URL in production)

All endpoints return JSON. Errors include a `code` and `message`. Successful responses have the data or a 2xx status.

## Health check

```
GET /health
```
Returns `{ ok: true }`. Used by the uptime monitor.

## Employees

### List
```
GET /employees?search=rao&country=IN&department=Engineering&level=L3&status=ACTIVE&currency=INR&sortBy=salary&sortDir=asc&page=1&pageSize=25
```
Query parameters (all optional):
- `search`: substring of full name, email or code (not case-sensitive, wildcards are literal)
- `country`: exact match
- `department`: exact match
- `level`: exact match
- `status`: `ACTIVE` or `INACTIVE`
- `currency`: exact match
- `sortBy`: `employeeCode`, `fullName`, `department`, `level`, `country`, `hireDate`, `salary` (default: `employeeCode`)
- `sortDir`: `asc` or `desc` (default: `asc`)
- `page`: 1-based (default: 1)
- `pageSize`: 1 to 100 (default: 25)

Returns:
```json
{
  "employees": [
    {
      "id": 1,
      "employeeCode": "EMP-00001",
      "fullName": "Emma Brown",
      "email": "emma@acme.example",
      "department": "Engineering",
      "jobTitle": "Senior Engineer",
      "level": "L3",
      "country": "United States",
      "employmentStatus": "ACTIVE",
      "hireDate": "2020-05-30",
      "salary": "105500.00",
      "currency": "USD"
    }
  ],
  "total": 10000,
  "page": 1,
  "pageSize": 25
}
```

### Get one
```
GET /employees/:id
```
Returns the employee, compensation history, and the most recent 10 salary changes.
```json
{
  "id": 1,
  "employeeCode": "EMP-00001",
  "fullName": "Emma Brown",
  "email": "emma@acme.example",
  "department": "Engineering",
  "jobTitle": "Senior Engineer",
  "level": "L3",
  "country": "United States",
  "employmentStatus": "ACTIVE",
  "hireDate": "2020-05-30",
  "compensation": {
    "id": 100,
    "amount": "105500.00",
    "currency": "USD",
    "effectiveAt": "2023-08-16"
  },
  "history": [
    {
      "id": 200,
      "previousAmount": "102400.00",
      "newAmount": "105500.00",
      "reason": "Promotion",
      "effectiveAt": "2023-08-16",
      "createdAt": "2023-08-16T14:30:00Z"
    }
  ]
}
```

### Create
```
POST /employees
Content-Type: application/json

{
  "fullName": "Alice Smith",
  "email": "alice@acme.example",
  "department": "Sales",
  "jobTitle": "Account Manager",
  "level": "L2",
  "country": "India",
  "hireDate": "2026-11-20",
  "salary": "50000.00"
}
```
The currency is determined from the country. Returns the created employee and its compensation.

### Update status
```
PATCH /employees/:id/status
Content-Type: application/json

{ "status": "INACTIVE" }
```
Sets the employment status to `ACTIVE` or `INACTIVE`. Returns the updated employee.

## Compensation

### Change salary
```
PATCH /employees/:id/compensation
Content-Type: application/json

{
  "amount": "110000.00",
  "reason": "Market adjustment"
}
```
Creates a new compensation record (the old one is kept for history). Returns the new compensation and the history entry.

Validation:
- `amount` is required, must be a non-negative number
- `reason` is required
- The new amount must be different from the current amount

### History
```
GET /employees/:id/compensation-history
```
Returns all salary changes for the employee (most recent first).

## Analytics

### Summary
```
GET /analytics/summary
```
Total headcount and counts by currency.
```json
{
  "totalHeadcount": 10000,
  "byCurrency": {
    "USD": 2000,
    "INR": 3000,
    "GBP": 1500,
    "JPY": 2500,
    "CAD": 500,
    "AUD": 500
  }
}
```

### By country
```
GET /analytics/by-country?currency=USD
```
Headcount, min/max/median salary for each country. The `currency` parameter is optional; if omitted, results are grouped by the country's default currency.

### By department
```
GET /analytics/by-department?currency=USD
```
Same structure, grouped by department.

### By level
```
GET /analytics/by-level?currency=USD
```
Same structure, grouped by level.

### Distribution (salary histogram)
```
GET /analytics/distribution?currency=INR&buckets=20
```
Returns salary distribution in `buckets` ranges (default 20, max 50).
```json
{
  "currency": "INR",
  "buckets": [
    { "from": 100000, "to": 200000, "count": 50 },
    { "from": 200000, "to": 300000, "count": 120 },
    ...
  ]
}
```

### Extremes (highest and lowest paid)
```
GET /analytics/extremes?currency=INR&limit=5
```
Returns the top N and bottom N earners (default 5, max 25).

### Recent changes
```
GET /analytics/recent-changes?limit=10
```
The 10 most recent salary changes (across all employees, not filtered by currency).

## Metadata

### Filters
```
GET /meta/filters
```
Returns the available values for dropdowns.
```json
{
  "countries": ["Australia", "Brazil", ...],
  "departments": ["Customer Support", "Engineering", ...],
  "levels": ["L1", "L2", "L3", "L4", "L5", "L6"],
  "statuses": ["ACTIVE", "INACTIVE"],
  "currencies": ["AUD", "BRL", "CAD", "EUR", "GBP", "INR", "JPY", "USD"]
}
```

## Error responses

All errors return JSON with `code` and `message`:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The search text is too long (max 50 characters)" } }
```

Common codes:
- `VALIDATION_ERROR` (400): input did not pass validation
- `NOT_FOUND` (404): employee not found
- `INTERNAL_ERROR` (500): server error (rare; includes a request ID for support)
