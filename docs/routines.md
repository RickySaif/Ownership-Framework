# Routines

How recurring runs work is in the hub playbook, [routines.md](../templates/hub/playbook/routines.md); the
`routine-setup` skill sets them up. The pieces:

| Piece | File in a hub |
|---|---|
| The scripted phases (start, specs, finish, time-left) | `tools/routine.mjs` (`npm run run -- …`) |
| What Claude does each night / week | `routines/nightly.prompt.md`, `routines/weekly.prompt.md` |
| What an unattended run may do | `routines/permissions.json` |
| Scheduling: cron, launchd, GitHub Actions, GitLab CI | `routines/*.example*` |
| What every run leaves behind | `runs/<app>/<run-id>/status.json`, `ledger.jsonl`, `charters/`, `findings.json`, `report.md` |

`status.json` fields: `mode` (nightly | weekly | attended), `started`, `finished`, `status` (complete |
inconclusive | aborted), `versions` (old → new SHA), `newFindings`, `possiblyFixed`, `regressions`, `specs`,
`explored`, `notExplored`, `notes`. Schema: [status.schema.json](../templates/hub/schemas/status.schema.json).

**Scheduling, in order of preference:** Claude Code scheduled agents (`/schedule`); cron or launchd on a machine the
team owns; a CI schedule. The example hub's sample run is in
[examples/acme-leave/hub/runs](../examples/acme-leave/hub/runs/acme-leave/).
