# Session notes: approvals (run 20261025-0006-nightly)

**Mapped** with Playwright MCP as each role: My leave (balance, new request, my requests, Cancel), Team (managers
only: Approve / Reject). API calls seen: `POST /api/requests`, `POST /api/requests/:id/approve|reject|cancel`,
`GET /api/team/requests`.

**Probed** with scripts:

| Probe | Expected (PRD) | Result |
|---|---|---|
| Ben approves his own pending request via API | 403, stays pending (R4) | **200, approved**: AL-1 |
| Ben approves Cleo's request via API | 403 (R4) | **200, approved**: AL-1 (same cause) |
| Ben rejects Cleo's request | 403 (R4) | 403 ✓ |
| Ana rejects her own request | 403 (R4) | 403 ✓ |
| Ana approves an already rejected request | 409 (R10) | 409 ✓ |

**Confirmed two ways** for AL-1: response 200 + `SELECT status, decided_by FROM requests` showed approved, decided_by =
Ben. Owner (fictional) confirmed not by design.

**Not reached:** manager approving their *own* request through the API (likely the same cause as AL-1; recorded in
notExplored for the next run).
