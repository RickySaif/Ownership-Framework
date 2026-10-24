# Nightly run 20261025-0006-nightly: acme-leave (local)

**Status:** complete · **Version:** first run → e0eab5e4 · **Hard stop:** 06:00 Asia/Jakarta (not reached)

## Specs
- Smoke: 6 passed.
- Regression: 14 tests: 10 passed, 4 known-bug-open (AL-1 ×2, AL-2, AL-3). No new regressions, nothing possibly fixed.
- Full e2e suite: 13 tests, 9 passed, 4 known-bug-open; covers 10 of 10 testable requirements (100%).
- Strict check: every knownBug test fails on its real assertion.

## New findings (all five deliverables made)
- **AL-1** (high) an employee can approve their own request, or a colleague's. `src/leave.mjs` approveRequest.
- **AL-2** (high) weekend days are charged as leave: Fri→Mon costs 4 days instead of 2. `src/leave.mjs` countDays.
- **AL-3** (medium) an end date before the start date is saved with negative days. `src/leave.mjs` createRequest.

## Not explored (next run)
- A manager approving their own request through the API.
- A weekend-only request (0 working days), after AL-2 is fixed.

## Cleanup
Everything the run created is in the ledger; on local the database is thrown away (cleanup "reset").
