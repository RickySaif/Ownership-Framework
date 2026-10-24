// US-1 Balance, end to end in the browser.
import { test, expect } from '../../../../lib/qa.mjs';
import { openAs, remainingDays, requestLeave } from './journeys.mjs';

test('R1 R5 the balance shows 20 days, and a pending request does not reduce it', async ({ browser, appName, track }) => {
  const ana = await openAs(browser, appName, 'manager');
  await expect(ana.locator('#bal-entitlement')).toHaveText('20');
  const before = await remainingDays(ana);
  const { row } = await requestLeave(ana, track, { start: '2030-09-02', end: '2030-09-03', label: 'e2e-pending' });
  await expect(row).toContainText('pending');
  expect(await remainingDays(ana), 'pending leave must not count').toBe(before);
});
