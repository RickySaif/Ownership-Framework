---
name: regression-spec
description: Writes a Playwright regression spec that states the CORRECT behaviour for a bug in a QA hub, wrapped in knownBug('<ID>', 'reason') while the bug is open so the suite stays green and flips when it is fixed. Every spec is proven twice with strict-check (REGRESSION_STRICT=1 must fail on its real assertion; normal mode must pass). Use after a bug is confirmed, for "add a test for this bug", "make sure it never comes back", or every bug that escaped to users.
---

# Regression spec

Work inside a QA hub. Library: `lib/qa.mjs` (`test`, `expect`, `knownBug`, `named`, fixtures `as`, `track`, `db`).
Specs live in `qa/<app>/specs/regression/<area>.spec.mjs`; shared helpers in `qa/<app>/specs/helpers.mjs`.

## Write the test

```js
import { test, expect, knownBug } from '../../../../lib/qa.mjs';
import { newRequest, storedRequest } from '../helpers.mjs';

test('R4 an employee cannot approve their own request', async ({ as, track, db }) => {
  knownBug('AL-1', 'approveRequest does not check the role or the requester');
  const ben = await as('employee');
  const req = await newRequest(ben, track, { start: '2030-02-04', end: '2030-02-04', label: 'al1' });
  const res = await ben.post(`/api/requests/${req.id}/approve`);
  expect(res.status, 'approving your own request must be refused (403)').toBe(403);
  const stored = await storedRequest(db, req.id);
  if (stored) expect(stored.status).toBe('pending');
});
```

Rules:
- The title starts with the **requirement id(s)** (`R4 …`). The board's coverage table reads them.
- Assert the **correct** behaviour from the requirement, never what the app does now. For money and dates, put the
  hand-worked value in a comment.
- `knownBug('<ID>', '<one-line cause>')` is the **first line** of the test, only while the bug is open.
- Check both ways where you can: the response and the stored state.
- Setup goes through helpers that **throw** (`HelperError`) when they cannot do their job. No `|| true`, no
  try/catch around assertions, no assertion that cannot fail.
- Everything created is named with `named(label)` and recorded with `track({ table, id, cleanup })`.
- Each test sets up its own data and does not depend on other tests or on data that existed before the run.

## Prove it

```sh
npm run strict-check -- --app <app>
```

It must say every knownBug test fails on its real assertion in strict mode, and the suite is green in normal
mode. If it reports a helper error, fix the setup. If a knownBug test passes in strict mode, the test does not
reproduce the bug: tighten it.

Then set `spec` in the bug file, `npm run validate`, and commit on a branch: spec changes go through a pull request.

## When the bug is fixed

The regression run reports it as **possibly fixed**. After a person confirms it, in a pull request: remove the
`knownBug` line, set the bug to `fixed` with `fixedAt`, run strict-check and validate. The spec now guards against the
bug coming back.
