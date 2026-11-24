// End-to-end smoke test: does what the HR manager does, in a real browser, against the seeded data.
// It CHANGES one salary. Run `npm run seed -w api` afterwards to reset the data. See docs/qa/README.md.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const problems = [];
page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
page.on('pageerror', (error) => problems.push(error.message));

console.log('1. Dashboard shows the headcount');
await page.goto(APP, { waitUntil: 'networkidle' });
const headcount = page.getByRole('region', { name: 'Headcount' });
await headcount.waitFor();
assert.match(await headcount.innerText(), /Employees\s+[\d,]{4,}/, 'a headcount in the thousands');

console.log('2. Search finds people');
await page.getByRole('link', { name: 'Employees', exact: true }).click();
await page.getByLabel('Search by name, email or code').fill('rao');
await page.waitForURL(/q=rao/);
const firstPerson = page.getByRole('table', { name: 'Employees' }).getByRole('link').first();
await firstPerson.waitFor();
const personName = await firstPerson.innerText();
assert.ok(personName.length > 0);

console.log(`3. Open ${personName} and change the salary`);
await firstPerson.click();
const salary = page.getByRole('region', { name: 'Current salary' });
const before = (await salary.innerText()).match(/([\d,]+\.\d{2}) ([A-Z]{3})/);
assert.ok(before, 'the salary is shown with its currency');
const [, oldText, currency] = before;
const newAmount = (Number(oldText.replaceAll(',', '')) + 1000).toFixed(2);

await page.getByRole('button', { name: 'Update salary' }).click();
await page.getByLabel(`New amount (${currency})`).fill(newAmount);
await page.getByLabel('Reason').fill('Smoke test raise');
await page.getByRole('button', { name: 'Save' }).click();
await page.getByText('Salary updated.').waitFor();
assert.match(await salary.innerText(), new RegExp(`${Number(newAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`));
const history = page.getByRole('list', { name: 'Salary history' });
await page.getByText('Smoke test raise').first().waitFor();
assert.match(await history.getByRole('listitem').first().innerText(), /Smoke test raise/);

console.log('4. The change appears in the dashboard');
await page.getByRole('link', { name: 'Dashboard' }).click();
const recent = page.getByRole('list', { name: 'Recent salary changes' });
await recent.waitFor();
assert.match(await recent.getByRole('listitem').first().innerText(), new RegExp(`${personName}[\\s\\S]*Smoke test raise`));

console.log('5. No errors in the browser console');
assert.deepEqual(problems, []);

console.log(`Smoke test passed. ${personName}: ${oldText} -> ${newAmount} ${currency}. Run "npm run seed -w api" to reset the data.`);
await browser.close();
