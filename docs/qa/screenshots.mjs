// Takes screenshots of the running app into docs/screenshots. See docs/qa/README.md.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const OUT = path.join(import.meta.dirname, '..', 'screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, address, { width = 1280, height = 900, fullPage = true, before } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));

  await page.goto(`${APP}${address}`, { waitUntil: 'networkidle' });
  if (before) await before(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`${name}.png`, problems.length ? `console errors: ${problems.join(' | ')}` : '');
  await page.close();
}

await shoot('dashboard', '/');
await shoot('dashboard-usd', '/?view=usd&country=IN', { fullPage: false, height: 1100 });
await shoot('employees', '/employees', { fullPage: false, height: 1000 });
await shoot('employee', '/employees/1', { fullPage: false, height: 760 });
await shoot('add-employee', '/employees/new', { fullPage: false, height: 560 });
await shoot('salary-dialog-errors', '/employees/1', {
  width: 1000,
  fullPage: false,
  height: 640,
  before: async (page) => {
    await page.getByRole('button', { name: 'Update salary' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Enter an amount.').waitFor();
  },
});
await shoot('employees-phone', '/employees', { width: 390, height: 900, fullPage: false });

await browser.close();
