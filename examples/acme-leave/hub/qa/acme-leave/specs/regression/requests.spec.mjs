// US-2 Request leave: R2 (working days only), R3 (valid range), R7 (not more than the balance), R9 (one year).
// Expected values are worked out by hand from the PRD, not read from the app:
//   Fri 8 Mar 2030 → Mon 11 Mar 2030 = Fri + Mon = 2 working days (Sat 9 and Sun 10 do not count)
//   Mon 1 Apr 2030 → Fri 5 Apr 2030 = 5 working days
import { test, expect, knownBug } from '../../../../lib/qa.mjs';
import { newRequest, remaining, storedRequest } from '../helpers.mjs';

test.describe('requests', () => {
  test('R2 a Friday-to-Monday request counts 2 working days', async ({ as, track, db }) => {
    knownBug('AL-2', 'countDays counts calendar days, so the weekend is charged');
    const cleo = await as('employee2');
    const ana = await as('manager');
    const before = await remaining(cleo);
    const req = await newRequest(cleo, track, { start: '2030-03-08', end: '2030-03-11', label: 'al2-weekend' });
    expect(req.days, 'Fri 8 + Mon 11 March = 2 working days').toBe(2);

    await ana.okPost(`/api/requests/${req.id}/approve`);
    expect(before - (await remaining(cleo)), 'the balance must drop by 2').toBe(2);
    const stored = await storedRequest(db, req.id);
    if (stored) expect(stored.days).toBe(2);
  });

  test('R2 a Monday-to-Friday week counts 5 working days', async ({ as, track }) => {
    const cleo = await as('employee2');
    const req = await newRequest(cleo, track, { start: '2030-04-01', end: '2030-04-05', label: 'full-week' });
    expect(req.days).toBe(5);
  });

  test('R3 an end date before the start date is refused and nothing is saved', async ({ as, db }) => {
    knownBug('AL-3', 'createRequest does not check that end >= start');
    const ben = await as('employee');
    const before = (await ben.okGet('/api/requests')).length;
    const res = await ben.post('/api/requests', { start: '2030-03-15', end: '2030-03-13', reason: 'reversed range' });
    expect(res.status, 'a reversed range must be refused (400)').toBe(400);
    expect((await ben.okGet('/api/requests')).length, 'nothing may be saved').toBe(before);
    if (db.available()) {
      const rows = await db.read("SELECT COUNT(*) AS n FROM requests WHERE days < 1");
      expect(Number(rows[0].n), 'no request with less than one day may exist').toBe(0);
    }
  });

  test('R7 a request longer than the remaining balance is refused', async ({ as }) => {
    const ben = await as('employee');
    const res = await ben.post('/api/requests', { start: '2030-06-03', end: '2030-07-26', reason: 'too long' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough leave/);
  });

  test('R9 a request across two calendar years is refused', async ({ as }) => {
    const ben = await as('employee');
    const res = await ben.post('/api/requests', { start: '2030-12-30', end: '2031-01-02', reason: 'new year' });
    expect(res.status).toBe(400);
  });

  test('R6 only the requester can cancel a pending request', async ({ as, track }) => {
    const ben = await as('employee');
    const cleo = await as('employee2');
    const req = await newRequest(ben, track, { start: '2030-05-06', end: '2030-05-06', label: 'cancel-other' });
    expect((await cleo.post(`/api/requests/${req.id}/cancel`)).status).toBe(403);
    expect((await ben.post(`/api/requests/${req.id}/cancel`)).status).toBe(200);
  });
});
