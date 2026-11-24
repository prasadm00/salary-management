// Uses the app with the keyboard only, and reports what happens. See docs/qa/README.md.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

/** A short description of the element that has the keyboard focus. */
const focused = () =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return '(nothing)';
    const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30) ?? '';
    return `${element.tagName.toLowerCase()}: ${label || element.id}`;
  });

console.log('Tab order on the employees page:');
await page.goto(`${APP}/employees`, { waitUntil: 'networkidle' });
const stops = [];
for (let i = 0; i < 6; i += 1) {
  await page.keyboard.press('Tab');
  stops.push(await focused());
}
stops.forEach((stop, index) => console.log(`  ${index + 1}. ${stop}`));
assert.equal(stops[0], 'a: Skip to content', 'the first Tab stop is the skip link');

console.log('Skip link moves focus to the main area');
await page.goto(`${APP}/employees`, { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => document.activeElement?.id), 'main');

console.log('Enter on a column heading sorts the table');
await page.getByRole('button', { name: /^Name/ }).focus();
await page.keyboard.press('Enter');
await page.waitForURL(/sortDir=desc/);

console.log('Salary dialog: opens, keeps focus inside, closes with Escape, returns focus');
await page.goto(`${APP}/employees/1`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Update salary' }).focus();
await page.keyboard.press('Enter');
await page.getByRole('dialog').waitFor();
for (let i = 0; i < 8; i += 1) {
  await page.keyboard.press('Tab');
  // At the end of the dialog, focus rests for a moment on an invisible guard element,
  // then moves back to the first field. Give it a moment to settle before looking.
  await page.waitForTimeout(100);
  assert.ok(
    await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
    'focus stays inside the dialog',
  );
}
await page.keyboard.press('Escape');
await page.getByRole('dialog').waitFor({ state: 'detached' });
assert.equal(await focused(), 'button: Update salary');

console.log('All keyboard checks passed.');
await browser.close();
