// US-5 Privacy, end to end.
import { test, expect } from '../../../../lib/qa.mjs';
import { openAs, requestLeave } from './journeys.mjs';

test('R8 an employee sees only their own requests and cannot open the team list', async ({ browser, appName, track, as }) => {
  const cleo = await openAs(browser, appName, 'employee2');
  const { reason } = await requestLeave(cleo, track, { start: '2030-10-07', end: '2030-10-07', label: 'e2e-private' });
  const ben = await openAs(browser, appName, 'employee');
  await expect(ben.getByTestId('my-requests')).toBeVisible();
  await expect(ben.getByTestId('my-requests')).not.toContainText(reason);
  await expect(ben.getByTestId('nav-team')).toBeHidden();
  await ben.goto('/#team');
  await expect(ben.getByTestId('team-requests')).toBeHidden();
  const api = await as('employee');
  expect((await api.get('/api/team/requests')).status).toBe(403);
});
