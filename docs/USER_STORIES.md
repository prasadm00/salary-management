# User Stories and Acceptance Criteria

**User:** HR manager. Each story has an ID so tests, tasks and commits can refer to it (for example, `US-03`).
Acceptance criteria (AC) are written so each one can become an automated test.

**Shared rules**
- Salary means annual base salary in the employee's local currency.
- Money is exact (two decimals). Currency is a 3-letter code such as `INR`, `USD`, `EUR`.
- Different currencies are never added or averaged together, except in the labelled USD view (US-13).
- List responses are paginated, with a page size of 1 to 100 (default 25).

---

## A. Find and view employees

### US-01 Browse the employee directory
As an HR manager, I can see a paginated list of all employees, so that I can work with 10,000 records without waiting.
- AC1: The first page shows 25 employees with name, code, department, level, country, salary and currency.
- AC2: The total count is shown (10,000 after seeding).
- AC3: I can move to the next, previous, first and last page.
- AC4: A page size above 100 is rejected with a clear error.
- AC5: A page beyond the last one returns an empty list and the correct total.

### US-02 Search employees
As an HR manager, I can search by name, email or employee code, so that I can find a person quickly.
- AC1: Search is case-insensitive and matches part of a word ("pri" finds "Priya").
- AC2: An exact employee code returns that employee.
- AC3: Results are paginated and the total reflects the search.
- AC4: No match shows an empty state with a message, not an error.
- AC5: Typing in the search box waits briefly before calling the server, so keystrokes do not flood it.

### US-03 Filter employees
As an HR manager, I can filter by country, department, level and status, so that I can narrow the list.
- AC1: Each filter works alone.
- AC2: Filters combine (country AND department AND level).
- AC3: Filters combine with search.
- AC4: Filter options come from the data, not hard-coded.
- AC5: Filters can be cleared with one action.
- AC6: Filters and page are kept in the page address, so a view can be shared or reloaded.

### US-04 Sort employees
As an HR manager, I can sort by name, salary, hire date, department or country, so that I can spot highest and lowest paid.
- AC1: Ascending and descending both work. Sorting by salary needs a single currency (or the USD view), because amounts in different currencies cannot be compared.
- AC2: An unsupported sort column is rejected with a clear error.
- AC3: Sorting keeps the current search and filters.
- AC4: Sort order is stable, so paging never repeats or skips a person.

### US-05 View an employee profile
As an HR manager, I can open an employee, so that I can see their details and pay.
- AC1: The profile shows name, code, email, job title, department, level, country, status, hire date.
- AC2: It shows current salary, currency and the date it took effect.
- AC3: An unknown employee shows a "not found" page and the API returns 404.

---

## B. Change data

### US-06 Add an employee
As an HR manager, I can add an employee with an initial salary, so that new hires are recorded.
- AC1: Required: name, email, department, job title, level, country, hire date, salary.
- AC2: A duplicate email or employee code is rejected with a clear message (409).
- AC3: The currency is set from the country and cannot be mismatched.
- AC4: Salary must be greater than zero and have at most two decimals.
- AC5: Hire date cannot be in the future.
- AC6: After saving, I land on the new profile.

### US-07 Update a salary
As an HR manager, I can change an employee's salary with a reason, so that pay stays correct and explainable.
- AC1: A reason is required.
- AC2: The new amount must be greater than zero, have at most two decimals, and differ from the current amount.
- AC3: The currency does not change here.
- AC4: The salary update and its history record are saved together. If one fails, neither is saved.
- AC5: The profile shows the new salary immediately.
- AC6: Errors are shown next to the field that caused them.

### US-08 See salary history
As an HR manager, I can see every past salary change for an employee, so that I can explain how pay evolved.
- AC1: Each entry shows old amount, new amount, currency, reason and date and time.
- AC2: Newest first.
- AC3: The first salary at creation appears as the starting entry.
- AC4: History cannot be edited or deleted.

### US-09 Deactivate an employee
As an HR manager, I can mark an employee inactive instead of deleting them, so that pay history is never lost.
- AC1: Status changes to inactive and the person stays searchable.
- AC2: Inactive employees can be filtered in or out.
- AC3: There is no delete action anywhere.

---

## C. Understand how the organisation pays

### US-10 Headcount overview
As an HR manager, I can see how many employees there are by country, department and level, so that I understand the workforce.
- AC1: Counts per country, department and level add up to the total.
- AC2: Filters narrow the counts.
- AC3: Only active employees are counted by default, with an option to include inactive.

### US-11 Salary statistics
As an HR manager, I can see minimum, maximum, average and median salary by country, department and level, so that I can judge pay fairness.
- AC1: Each statistic is shown with its currency.
- AC2: Groups with different currencies appear as separate rows or cards. They are never combined.
- AC3: Results are correct on a small hand-checked dataset (used in tests). The median is exact.
- AC4: The same filters as the directory apply.
- AC5: A group with no employees is not shown, and there is no divide-by-zero.

### US-12 Salary distribution
As an HR manager, I can see a chart of how salaries are spread within one currency, so that I can spot clusters and outliers.
- AC1: I choose a currency (default: the most common one).
- AC2: Bars show employee counts per salary range.
- AC3: Bucket edges are shown, and every employee is in exactly one bucket.
- AC4: The chart updates with filters.

### US-13 Compare countries in USD
As an HR manager, I can switch on a USD view, so that I can compare countries on one scale.
- AC1: The view is off by default.
- AC2: When on, every figure is labelled as USD and shows the rates' "as of" date.
- AC3: A note explains the rates are fixed and illustrative.
- AC4: Switching it off returns to local-currency groups.
- AC5: Conversion is rounded to two decimals only at the end, never in between.

### US-14 Highest and lowest paid, recent changes
As an HR manager, I can see the highest and lowest paid employees and the latest salary changes, so that I can spot anomalies.
- AC1: The top 10 and bottom 10 are listed per currency.
- AC2: The last 10 changes show person, old and new amount, reason and date.
- AC3: Each row links to the profile.

---

## D. Data and delivery

### US-15 Seed realistic data
As the person running the project, I can run one command to create 10,000 fictional employees, so that I can demo at the real scale.
- AC1: Exactly 10,000 employees, with unique codes and emails.
- AC2: At least 8 countries with their own currencies, and several departments and levels.
- AC3: Salaries fall inside a sensible band per country and level.
- AC4: The same seed value gives identical data every time.
- AC5: Running it twice does not create duplicates.
- AC6: It finishes in well under a minute locally (the actual time is recorded in the performance notes).

### US-16 Fast and reliable experience
As an HR manager, I get quick responses and clear errors, so that I can trust the tool.
- AC1: List and statistics calls respond in under 300 ms on 10,000 records (measured and recorded).
- AC2: Loading, empty and error states exist on every screen.
- AC3: Errors use one consistent format with a message a non-technical person can understand.
- AC4: The app works with the keyboard and has labelled form fields.

### US-17 Live and documented
As a reviewer, I can open a public link, read the docs and watch a short demo, so that I can judge the work.
- AC1: The live URL loads the app with the seeded data.
- AC2: The README explains how to run, test and deploy.
- AC3: A demo video link is in the README.
- AC4: The first slow load on the free host is explained in the README.

---

## Traceability to requirements

| Requirement (REQUIREMENTS.md) | Stories |
| --- | --- |
| Employee directory | US-01 to US-04 |
| Employee profile | US-05 |
| Add employee | US-06 |
| Update salary with history | US-07, US-08, US-09 |
| Insights dashboard | US-10 to US-14 |
| Seed script | US-15 |
| Deployed, documented, demo | US-16, US-17 |
