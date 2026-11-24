# Prompt: React component architecture

## Input
Design a React app layout for a salary management system. It has:
- A dashboard (headcount cards, statistics table, salary histogram, highest/lowest paid, recent changes)
- An employees page (search, filters, sortable table with paging)
- An employee detail page (profile, current salary, history, edit button)
- An add employee form

Describe the component tree, data fetching strategy, and form state management.

## Output summary
App shell with routing. Dashboard, employees list, employee detail, and form pages. React Query for server data. Plain `useState` for form state. URL parameters for page filters (search, country, etc.).

## Key decisions made
- Filters live in the URL, not in a Redux store
- Each page fetches its own data (no prop drilling)
- Form state is local (no form library)
- Search box debounces with `setTimeout`
