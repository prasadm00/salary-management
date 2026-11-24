// Runs the axe accessibility checker, including colour contrast, on each page in a real browser.
// See docs/qa/README.md. Exits with an error if any page has a problem.
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const browser = await chromium.launch();
let failures = 0;

async function check(label, address, { width = 1280, before } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${APP}${address}`, { waitUntil: 'networkidle' });
  if (before) await before(page);
  await page.addScriptTag({ path: axePath });
  const { violations, passes } = await page.evaluate(() => globalThis.axe.run());

  console.log(`${violations.length === 0 ? 'OK  ' : 'FAIL'} ${label} (${passes.length} rules passed)`);
  for (const violation of violations) {
    failures += 1;
    console.log(`   - ${violation.id} [${violation.impact}] ${violation.help} (${violation.nodes.length} places)`);
  }
  await page.close();
}

await check('dashboard', '/');
await check('dashboard in US dollars', '/?view=usd');
await check('dashboard, phone width', '/', { width: 390 });
await check('employees', '/employees');
await check('employees, filtered and sorted', '/employees?country=IN&q=rao&sortBy=salary');
await check('employees, phone width', '/employees', { width: 390 });
await check('employee page', '/employees/1');
await check('add employee', '/employees/new');
await check('add employee, with errors', '/employees/new', {
  before: async (page) => {
    await page.getByRole('button', { name: 'Add employee' }).click();
    await page.getByText('Enter the full name.').waitFor();
  },
});
await check('salary dialog, with errors', '/employees/1', {
  before: async (page) => {
    await page.getByRole('button', { name: 'Update salary' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Enter an amount.').waitFor();
  },
});
await check('page not found', '/nothing-here');

await browser.close();
process.exit(failures === 0 ? 0 : 1);
