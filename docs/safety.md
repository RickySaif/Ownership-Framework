# Safety rules

The short version is the picture in the README; the full rules are in the hub playbook,
[safety.md](../templates/hub/playbook/safety.md). This page explains how the tools **enforce** them.

| Rule | Enforced by |
|---|---|
| App source is read-only | `npm run sync` makes `apps/` read-only on disk and installs git hooks that refuse commits there; the hub's `.claude/settings.json` denies Claude edits under `apps/`; `sync:check` stops a run if the copy was changed; hub tools refuse to write inside `apps/` |
| The run tests the commit it says it tests | `npm run sync:check` compares the checkout with the run's `versions.new` |
| Only change what the run created | specs record what they create with `track()` in `runs/<app>/<run-id>/ledger.jsonl`; `npm run cleanup` reads only the ledger |
| Local DB writes never reach a shared DB | `db.write()` refuses local writes unless `QA_ISOLATED_DB` names the local database and the host is this machine |
| Shared DB writes are small and traceable | `db.write()` on dev/staging: only ledger rows or permanent test rows, one statement, one transaction, row cap, before/after in the ledger, SQL saved to `qa/<app>/db-actions/` |
| Production is never written | `db.write()` refuses `prod`; `npm run regression` refuses `prod` unless a written, time-boxed exception is in `registry.yaml` |
| Reads cannot change data | `db.read()` accepts a single SELECT only; SQLite reads open the file read-only |
| No secrets in files | secrets are `{ env }` / `{ keychain }` references; `npm run validate` and `npm run init` flag literal secrets in `registry.yaml`; the framework repo runs a secret scan before every commit and gitleaks in CI |
| Unattended runs can do only what they need | `routines/permissions.json` allow-lists the hub's scripts and denies edits in `apps/`, pushes to main, raw `psql`/`mysql` and `.env` reads |
| Changes to specs and bug states are reviewed | routines commit on a `qa/*` branch and open a pull request |

## Data

- Test accounts are synthetic and made for testing. Their passwords live in the OS keychain or in environment
  variables (CI secrets), never in a file.
- Seed data is synthetic or masked, never a copy of real customer data.
- Videos and screenshots never show a password: `as()` logs in without displaying it, and demos use test accounts.
