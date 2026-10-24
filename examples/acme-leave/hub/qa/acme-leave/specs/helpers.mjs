// Acme Leave helpers for specs. They throw on failure (HelperError), so setup problems never look like bugs.
import { HelperError, named } from '../../../lib/qa.mjs';
import { targetEnv } from '../../../tools/lib/hub.mjs';

// Creates a leave request as `client` and records it in the run ledger. Returns the created row.
export async function newRequest(client, track, { start, end, label }) {
  const res = await client.post('/api/requests', { start, end, reason: named(label) });
  if (res.status !== 201) throw new HelperError(`create request ${start}..${end} as ${client.role}: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  track({
    table: 'requests',
    id: res.body.id,
    // Local: the database is thrown away. Shared environments: cancel through the app, as its owner.
    cleanup: targetEnv() === 'local' ? { via: 'reset' } : { via: 'api', role: client.role, method: 'POST', path: `/api/requests/${res.body.id}/cancel` },
  });
  return res.body;
}

export async function remaining(client, year = 2030) {
  const b = await client.okGet(`/api/balance?year=${year}`);
  if (typeof b.remaining !== 'number') throw new HelperError(`balance for ${client.role} has no "remaining": ${JSON.stringify(b)}`);
  return b.remaining;
}

// Second confirmation: the stored row, read straight from the database (read-only).
export async function storedRequest(db, id) {
  if (!db.available()) return null;
  const rows = await db.read(`SELECT id, user_id, start_date, end_date, days, status, decided_by FROM requests WHERE id = ${Number(id)}`);
  return rows[0] || null;
}
