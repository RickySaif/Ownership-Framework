// Browser helpers for the Acme Leave e2e suite. Black box: only what a user sees and clicks, plus test ids.
// They throw on failure (HelperError), so a broken setup never looks like a pass or a bug.
import { HelperError, loginPage, named } from '../../../../lib/qa.mjs';
import { envConfig } from '../../../../tools/lib/hub.mjs';

// A separate browser session per role, so two people can work side by side in one test.
export async function openAs(browser, appName, role) {
  const context = await browser.newContext({ baseURL: envConfig(appName).url });
  const page = await context.newPage();
  await loginPage(page, appName, role);
  return page;
}

export async function remainingDays(page) {
  await page.goto('/'); // a fresh load, so the number is current
  const box = page.getByTestId('remaining');
  try {
    await box.filter({ hasText: /\d/ }).waitFor({ timeout: 5000 });
  } catch {
    throw new HelperError('the balance did not appear');
  }
  const text = await box.textContent();
  if (!/^-?\d+$/.test(text?.trim() || '')) throw new HelperError(`balance shows "${text}"`);
  return Number(text.trim());
}

export async function fillRequest(page, { start, end, reason }) {
  await page.goto('/');
  await page.getByTestId('start').fill(start);
  await page.getByTestId('end').fill(end);
  await page.getByTestId('reason').fill(reason);
  await page.getByTestId('submit-request').click();
}

// Requests leave through the form and returns { id, row } for the new row. Records it in the run ledger.
export async function requestLeave(page, track, { start, end, label }) {
  const reason = named(label);
  await fillRequest(page, { start, end, reason });
  const row = page.locator('[data-testid=my-requests] tbody tr').filter({ hasText: reason });
  try {
    await row.waitFor({ timeout: 5000 });
  } catch {
    const err = await page.getByTestId('request-error').textContent();
    throw new HelperError(`request ${start}..${end} did not appear (form said: "${err}")`);
  }
  const id = Number(await row.getAttribute('data-request-id'));
  track({ table: 'requests', id, cleanup: { via: 'reset' } });
  return { id, row, reason };
}

export const cell = (row, n) => row.locator('td').nth(n);
export const teamRow = (page, id) => page.locator(`[data-testid=team-requests] tbody tr[data-request-id="${id}"]`);
