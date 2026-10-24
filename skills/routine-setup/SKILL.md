---
name: routine-setup
description: Sets up recurring QA runs for a QA hub: nightly (preflight, all specs, explore only what changed, cleanup from the ledger, board rebuild, hard stop) and weekly (deeper hunt plus a spec-assurance pass over one rotating area). Schedules them with Claude Code scheduled agents, cron or launchd, or a CI schedule, with a permissions file that allows only what a run needs. Use when someone asks to "run this every night", "schedule QA", "automate the checks".
---

# Routine setup

Work inside a QA hub. Method: `playbook/routines.md`. Templates: `routines/`.

## 1. Ask (one question at a time, with defaults)

- Which apps and which environment (**staging**, never production beyond smoke).
- Nightly time and hard stop (**01:30 → 06:00**, hub time zone), weekly day and time (**Saturday 09:00 → 13:00**),
  weekly rotation of areas (**the app's `areas` from the registry**).
- If unattended runs will **write** to a shared database: does it restore itself nightly? If not, who takes a
  snapshot first? Record the answer in `registry.yaml` (`db.restoresNightly`) and `CLAUDE.md`.
- Where it runs, in this order of preference: **Claude Code scheduled agents (`/schedule`)**; cron or launchd on a
  machine the team owns; a CI schedule (GitHub Actions or GitLab CI).

## 2. Write it down

- `registry.yaml` → `apps.<app>.routines.nightly|weekly`: `enabled`, `at`, `hardStop`, `env`, `rotation`.
- `CLAUDE.md` → the "Routines" line.
- `routines/<app>-nightly.prompt.md` and `routines/<app>-weekly.prompt.md` from `routines/nightly.prompt.md` and
  `routines/weekly.prompt.md`, with `{{app}}`, `{{env}}`, `{{timezone}}` and `{{hardStop}}` filled in.

## 3. Schedule it

- **/schedule**: create a scheduled agent with the filled-in prompt, in the hub repo, at the chosen time.
- **cron / launchd**: fill in `routines/cron.example` or `routines/launchd.example.plist` (the hub path, the prompt
  file), install it, and show the user how to check it ran (`runs/cron.log`).
- **CI**: copy `routines/github-actions.example.yml` or `routines/gitlab-ci.example.yml`, adjust the schedule (CI
  cron is UTC), and list the secrets to add (Claude API key, each test-account password env var). Never put a
  secret value in the file.

Every unattended run uses `routines/permissions.json`: it allows the hub's npm scripts, writing under `qa/`,
`runs/` and `board/`, git on `qa/*` branches and opening pull requests; it denies edits in `apps/`, pushes to main,
direct `psql`/`mysql`, and reading `.env` files.

## 4. Check it

Run the routine once now in attended mode (`--mode attended`), watch it end to end, and show the user the
`status.json`, the pull request it opened, and the board. Every run must write `runs/<app>/<run-id>/status.json`
with `mode`, `started`, `finished`, `status` (complete | inconclusive | aborted), `versions` (old → new SHA),
`newFindings`, `possiblyFixed`, `specs`, `notExplored`, `notes`.

Changes to specs, `knownBug` markers or bug states always go through a pull or merge request, never straight to main.
