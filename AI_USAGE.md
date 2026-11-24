# AI Usage

I built this project myself, using Kiro (an AI coding assistant) as a pair programmer for writing code and tests.

## What I did
- Defined the goal, the plan and the phases, and set the scope and priorities.
- Made and approved the key choices:
  - Currency comes from the country, never from the user.
  - No login, because the data is fictional.
  - The US dollar view uses fixed, labelled, illustrative rates.
  - Plain React state and native dropdowns, with no form library.
- Reviewed every phase before moving on, and ran the app by hand.
- Kept the output simple and short, and removed anything that did not belong.

## What the AI helped with
- Writing the code and tests from my plan.
- Running checks: lint, types, about 1,000 tests, accessibility, keyboard and a browser smoke test.
- Drafting the docs, which I then edited and checked against the code.

## What the AI got wrong, and the fix
| Problem | Fix |
| --- | --- |
| shadcn setup pointed components at an unrelated npm package | Replaced with our own helper |
| A build tool was listed as a runtime dependency | Moved to dev dependencies |
| "Clear filters" left old text in the search box | Search box now follows the address bar |
| Wide tables could not be scrolled with the keyboard | Added a focusable, labelled scroll area |
| Salary column was cut off on phones | Hid minor columns, showed department under the name |
| A hand edit of the lockfile briefly broke Prisma | Redone the standard way and re-checked |
| The page fallback route crashed the server on start (Express 5 rejects `*`) | Replaced with a middleware, and added tests |
| Some docs were rewritten from memory and no longer matched the code (invented timings, wrong schema) | Restored the measured versions from git and re-checked every document against the code |

## Prompts
Three key prompts, with what each produced, are in [`docs/prompts/`](docs/prompts/README.md).

## How I checked the result
Lint, types and all tests pass. The accessibility checker passes on 11 page states. I tried 18 hostile requests against the API, and ran an end-to-end smoke test. Details are in `docs/QUALITY.md`.
