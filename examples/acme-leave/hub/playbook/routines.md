# Routines

Routines are recurring runs. Each one writes `runs/<app>/<run-id>/status.json` and commits to the hub **on a branch**.
Changes to specs, `knownBug` markers or bug states go through a pull or merge request, never straight to main.

## Nightly

| Step | Command | Notes |
|---|---|---|
| 1. Preflight | `npm run run -- start --app <app> --mode nightly` | Syncs the tip of the branch, runs `sync:check`, creates the run, prints what changed |
| 2. Specs | `npm run run -- specs --app <app> --run <id>` | Smoke, then all regression specs. The smoke suite's first test is the login check. Red stops the line: report a new regression first |
| 3. Explore the diff | the exploratory-hunt skill | Only what changed since the last tested commit (the files printed in step 1). Check `npm run run -- time-left` between charters |
| 4. Deliver | bug-report, bug-video, regression-spec skills | For each confirmed finding |
| 5. Finish | `npm run run -- finish --app <app> --run <id>` | Cleanup from the ledger, validate, board rebuild |
| 6. Hard stop | | Whatever is not done by the hard stop goes to `notExplored`, and the run ends `inconclusive` |

## Weekly

A deeper exploratory session on one area, plus a spec-assurance pass over one area, rotating through the list in
`registry.yaml` (`routines.weekly.rotation`), so every area is checked over a few weeks.

## Attended

Started by a person, run with them watching. Same commands, `--mode attended`.

## Scheduling

In order of preference:

1. **Claude Code scheduled agents** (`/schedule`): the routine prompt in `routines/nightly.prompt.md`.
2. **cron or launchd** on a machine the team owns: `routines/cron.example` and `routines/launchd.example.plist`.
3. **CI schedule**: `routines/github-actions.example.yml` or `routines/gitlab-ci.example.yml`.

Unattended runs use `routines/permissions.json`, which allows only what a run needs.
