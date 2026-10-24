// US-3 Decide, end to end: an employee asks in one browser, the manager decides in another.
import { test, expect, knownBug } from '../../../../lib/qa.mjs';
import { openAs, remainingDays, requestLeave, teamRow } from './journeys.mjs';

test('R4 R5 a manager approves a request in the Team list and the balance drops', async ({ browser, appName, track }) => {
  const cleo = await openAs(browser, appName, 'employee2');
  const ana = await openAs(browser, appName, 'manager');
  const before = await remainingDays(cleo);
  const { id } = await requestLeave(cleo, track, { start: '2030-02-11', end: '2030-02-11', label: 'e2e-approve' });
  await ana.goto('/#team');
  await teamRow(ana, id).getByTestId('approve').click();
  await expect(teamRow(ana, id)).toContainText('approved');
  expect(await remainingDays(cleo), 'one approved working day').toBe(before - 1);
});

test('R4 a manager rejects a request and the balance does not change', async ({ browser, appName, track }) => {
  const cleo = await openAs(browser, appName, 'employee2');
  const ana = await openAs(browser, appName, 'manager');
  const before = await remainingDays(cleo);
  const { id, row } = await requestLeave(cleo, track, { start: '2030-02-12', end: '2030-02-12', label: 'e2e-reject' });
  await ana.goto('/#team');
  await teamRow(ana, id).getByTestId('reject').click();
  await expect(teamRow(ana, id)).toContainText('rejected');
  await cleo.reload();
  await expect(row).toContainText('rejected');
  expect(await remainingDays(cleo)).toBe(before);
});

test('R4 an employee cannot decide requests: no Team tab, and the API refuses', async ({ browser, appName, track, as }) => {
  knownBug('AL-1', 'approveRequest does not check the role or the requester');
  const cleo = await openAs(browser, appName, 'employee2');
  const { id } = await requestLeave(cleo, track, { start: '2030-02-13', end: '2030-02-13', label: 'e2e-employee-decides' });
  const ben = await openAs(browser, appName, 'employee');
  await expect(ben.getByTestId('nav-team')).toBeHidden();
  const api = await as('employee');
  expect((await api.post(`/api/requests/${id}/approve`)).status, 'an employee may not approve').toBe(403);
});

test('R4 a manager cannot decide their own request', async ({ browser, appName, track, as }) => {
  knownBug('AL-1', 'approveRequest does not check the role or the requester');
  const ana = await openAs(browser, appName, 'manager');
  const { id } = await requestLeave(ana, track, { start: '2030-02-14', end: '2030-02-14', label: 'e2e-own' });
  await ana.goto('/#team');
  await expect(teamRow(ana, id).getByTestId('approve'), 'no Approve button on your own request').toHaveCount(0);
  const api = await as('manager');
  expect((await api.post(`/api/requests/${id}/approve`)).status, 'deciding your own request must be refused').toBe(403);
});

test('R10 a decided request shows no actions and cannot be decided again', async ({ browser, appName, track, as }) => {
  const cleo = await openAs(browser, appName, 'employee2');
  const ana = await openAs(browser, appName, 'manager');
  const { id } = await requestLeave(cleo, track, { start: '2030-02-15', end: '2030-02-15', label: 'e2e-twice' });
  await ana.goto('/#team');
  await teamRow(ana, id).getByTestId('reject').click();
  await expect(teamRow(ana, id).getByRole('button')).toHaveCount(0);
  const api = await as('manager');
  expect((await api.post(`/api/requests/${id}/approve`)).status).toBe(409);
});
