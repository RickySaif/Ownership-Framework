// US-1 Balance (R1, R5) and US-5 Privacy (R8).
import { test, expect } from '../../../../lib/qa.mjs';
import { newRequest, remaining } from '../helpers.mjs';

test.describe('balance and privacy', () => {
  test('R1 R5 the entitlement is 20 days and a pending request does not count', async ({ as, track }) => {
    const ana = await as('manager');
    const b = await ana.okGet('/api/balance?year=2030');
    expect(b.entitlement).toBe(20);
    const before = await remaining(ana);
    await newRequest(ana, track, { start: '2030-09-02', end: '2030-09-03', label: 'pending-only' });
    expect(await remaining(ana)).toBe(before);
  });

  test('R8 an employee cannot see the team list', async ({ as }) => {
    const ben = await as('employee');
    expect((await ben.get('/api/team/requests')).status).toBe(403);
  });

  test('R8 an employee sees only their own requests', async ({ as, track }) => {
    const ben = await as('employee');
    const cleo = await as('employee2');
    await newRequest(cleo, track, { start: '2030-10-07', end: '2030-10-07', label: 'privacy' });
    const mine = await ben.okGet('/api/requests');
    expect(mine.every((r) => r.user_id === ben.me.id)).toBe(true);
  });
});
