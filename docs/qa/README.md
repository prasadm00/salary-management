# Browser checks

Automated tests cover behaviour. These scripts check what tests cannot: how the app looks in a real
browser, whether colours have enough contrast, and whether it works with the keyboard alone.
They are not part of `npm test`, because they need a browser and a running app.

| Script | What it does |
| --- | --- |
| `screenshots.mjs` | Saves screenshots of the main screens into `docs/screenshots/` |
| `accessibility.mjs` | Runs the axe accessibility checker (including colour contrast) on 11 page states, on desktop and phone widths |
| `keyboard.mjs` | Tab order, the "skip to content" link, sorting with Enter, and the salary dialog (focus stays inside, Escape closes it, focus returns) |

## How to run

```bash
# 1. Once: install the tools. --no-save keeps them out of package.json.
npm install --no-save playwright-core axe-core
npx playwright-core install chromium

# 2. Start the database, seed it, and start the API and the web app (two terminals)
npm run seed -w api
npm run dev -w api
npm run dev -w web          # http://localhost:5173

# 3. Run the checks
node docs/qa/accessibility.mjs
node docs/qa/keyboard.mjs
node docs/qa/screenshots.mjs
```

Set `APP_URL` to check another address, for example the deployed app.

## Latest result

- Accessibility: 11 of 11 page states pass, with no colour-contrast problems.
- Keyboard: all checks pass.
- The same accessibility rules also run inside the normal test suite (`npm test`), except colour contrast,
  which needs a real screen.
