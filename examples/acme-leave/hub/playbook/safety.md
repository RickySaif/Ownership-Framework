# Safety by environment

| | Local | Dev / staging (shared) | Production |
|---|---|---|---|
| What it is | A throw-away copy on your own machine (for example Docker Compose) | Shared test environments | Real users |
| UI and API | Anything | Anything a test user may do, on test accounts | Read-only smoke on synthetic accounts |
| Database reads | Yes | Yes | Only with a read-only role, if one was granted |
| Database writes | Yes, free to reset | Only rows this run created (ledger) or the hub's permanent test accounts | **Never** by the AI |
| Guard | `QA_ISOLATED_DB` must name the local database, or writes fail | One transaction, row cap, before/after logged, SQL committed under `qa/<app>/db-actions/` | `write()` refuses outright |
| Unattended runs | Fine | Snapshot first, or the environment restores itself every night (recorded in the registry) | Smoke only |
| Who approves | You | The app owner, by agreeing to the registry entry | A written, time-boxed exception in `CLAUDE.md`: who approved, scope, end date |

## Using the database

The AI has database access on local, dev and staging. It uses it to:

- **confirm** a bug's stored state (the second way of confirming);
- **set up** data the UI cannot create;
- **move dates** to test time-based features: expiry, accrual, reminders, month end.

Still prefer the app's UI or API for changes, so its business rules run. Use the database only when the app offers
no way to do it. Every write goes through `db.write()` in `tools/lib/db.mjs`, which enforces the rules above.

## Data

- Seed and test data are **synthetic or masked**, never a copy of real customer data.
- Test accounts are made for testing. Their passwords live in the OS keychain or environment variables, never in a file.
- Connection details (host, port, engine, database name) come from `registry.yaml`; secrets from the keychain or env.
- When a database is not exposed, the registry says how to reach it: an SSH tunnel (`db.tunnel`) or a VPN (`db.vpn`).
