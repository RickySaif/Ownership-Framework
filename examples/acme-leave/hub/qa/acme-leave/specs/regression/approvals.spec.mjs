// US-3 Decide: R4 (only a manager decides, never their own request) and R10 (only pending requests).
import { test, expect, knownBug } from '../../../../lib/qa.mjs';
import { newRequest, storedRequest } from '../helpers.mjs';

test.describe('approvals', () => {
  test('R4 an employee cannot approve their own request', async ({ as, track, db }) => {
    knownBug('AL-1', 'approveRequest does not check the role or the requester');
    const ben = await as('employee');
    const req = await newRequest(ben, track, { start: '2030-02-04', end: '2030-02-04', label: 'al1-self-approve' });

    const res = await ben.post(`/api/requests/${req.id}/approve`);
    expect(res.status, 'approving your own request must be refused (403)').toBe(403);

    const stored = await storedRequest(db, req.id);
    if (stored) expect(stored.status, 'the request must still be pending').toBe('pending');
  });

  test('R4 an employee cannot approve a colleague\'s request', async ({ as, track, db }) => {
    knownBug('AL-1', 'approveRequest does not check the role or the requester');
    const ben = await as('employee');
    const cleo = await as('employee2');
    const req = await newRequest(cleo, track, { start: '2030-02-05', end: '2030-02-05', label: 'al1-colleague' });

    const res = await ben.post(`/api/requests/${req.id}/approve`);
    expect(res.status, 'only a manager may approve (403)').toBe(403);

    const stored = await storedRequest(db, req.id);
    if (stored) expect(stored.status).toBe('pending');
  });

  test('R4 a manager approves an employee\'s request', async ({ as, track, db }) => {
    const ana = await as('manager');
    const cleo = await as('employee2');
    const req = await newRequest(cleo, track, { start: '2030-02-06', end: '2030-02-06', label: 'approve-ok' });

    const res = await ana.post(`/api/requests/${req.id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.decided_by).toBe(ana.me.id);

    const stored = await storedRequest(db, req.id);
    if (stored) expect(stored.status).toBe('approved');
  });

  test('R4 an employee cannot reject a request', async ({ as, track }) => {
    const ben = await as('employee');
    const cleo = await as('employee2');
    const req = await newRequest(cleo, track, { start: '2030-02-07', end: '2030-02-07', label: 'reject-forbidden' });
    const res = await ben.post(`/api/requests/${req.id}/reject`);
    expect(res.status).toBe(403);
  });

  test('R10 a decided request cannot be decided again', async ({ as, track }) => {
    const ana = await as('manager');
    const cleo = await as('employee2');
    const req = await newRequest(cleo, track, { start: '2030-02-08', end: '2030-02-08', label: 'decide-twice' });
    expect((await ana.post(`/api/requests/${req.id}/reject`)).status).toBe(200);
    expect((await ana.post(`/api/requests/${req.id}/approve`)).status).toBe(409);
  });
});
