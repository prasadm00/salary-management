# Prompt: Test coverage plan

## Input
Write a test strategy for a salary app. What should be tested and why? Types: unit (logic), integration (API + database), UI (browser). What scenarios matter most?

## Output summary
- Unit tests for money, currency and validation rules
- API tests: 1 per endpoint, using a real test database that resets
- UI tests: verify page interactions, form validation, filter changes call the API
- Target: >90% coverage for domain logic, >70% for UI

## Key decisions made
- Use a separate test database (`salary_management_test`)
- Tests refuse to run on a database whose name doesn't end in `_test`
- Fake `fetch` in UI tests so we can verify the exact request
- No E2E tests in CI (too slow); manual smoke test in Phase 7
