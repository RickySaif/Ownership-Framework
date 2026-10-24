// US-2 Request leave and US-4 Cancel, end to end in the browser.
// Hand-worked expectations: Mon 8 → Fri 12 Apr 2030 = 5 working days; Fri 15 → Mon 18 Mar 2030 = Fri + Mon = 2.
import { test, expect, knownBug, named } from '../../../../lib/qa.mjs';
import { openAs, fillRequest, requestLeave, cell } from './journeys.mjs';

test('R2 a Monday-to-Friday week is charged 5 days', async ({ browser, appName, track }) => {
  const cleo = await openAs(browser, appName, 'employee2');
  const { row } = await requestLeave(cleo, track, { start: '2030-04-08', end: '2030-04-12', label: 'e2e-week' });
  await expect(cell(row, 2)).toHaveText('5');
});

test('R2 a Friday-to-Monday request is charged 2 days, not the weekend', async ({ browser, appName, track }) => {
  knownBug('AL-2', 'countDays counts calendar days, so the weekend is charged');
  const cleo = await openAs(browser, appName, 'employee2');
  const { row } = await requestLeave(cleo, track, { start: '2030-03-15', end: '2030-03-18', label: 'e2e-weekend' });
  await expect(cell(row, 2), 'Fri 15 + Mon 18 March = 2 working days').toHaveText('2');
});

test('R3 a reversed date range is refused with a message and nothing is saved', async ({ browser, appName }) => {
  knownBug('AL-3', 'createRequest does not check that end >= start');
  const ben = await openAs(browser, appName, 'employee');
  const reason = named('e2e-reversed');
  await fillRequest(ben, { start: '2030-05-17', end: '2030-05-15', reason });
  await expect(ben.getByTestId('request-error'), 'the form must say why').toHaveText(/\S/);
  await expect(ben.locator('[data-testid=my-requests] tbody tr').filter({ hasText: reason }), 'nothing may be saved').toHaveCount(0);
});

test('R7 a request longer than the remaining balance is refused with a message', async ({ browser, appName }) => {
  const ben = await openAs(browser, appName, 'employee');
  const reason = named('e2e-too-long');
  await fillRequest(ben, { start: '2030-06-03', end: '2030-07-26', reason });
  await expect(ben.getByTestId('request-error')).toHaveText(/not enough leave/);
  await expect(ben.locator('[data-testid=my-requests] tbody tr').filter({ hasText: reason })).toHaveCount(0);
});

test('R9 a request across the new year is refused with a message', async ({ browser, appName }) => {
  const ben = await openAs(browser, appName, 'employee');
  await fillRequest(ben, { start: '2030-12-30', end: '2031-01-02', reason: named('e2e-new-year') });
  await expect(ben.getByTestId('request-error')).toHaveText(/one calendar year/);
});

test('R6 an employee cancels their own pending request, and nobody else can', async ({ browser, appName, track, as }) => {
  const ben = await openAs(browser, appName, 'employee');
  const { id, row } = await requestLeave(ben, track, { start: '2030-05-06', end: '2030-05-06', label: 'e2e-cancel' });
  const cleo = await as('employee2');
  expect((await cleo.post(`/api/requests/${id}/cancel`)).status, 'a colleague may not cancel it').toBe(403);
  await row.getByTestId('cancel').click();
  await expect(row).toContainText('cancelled');
  await expect(row.getByTestId('cancel')).toHaveCount(0);
});
