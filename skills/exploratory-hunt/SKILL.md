---
name: exploratory-hunt
description: Time-boxed bug hunting in a web app, from charters (area, risk, persona, time box). Use when someone asks to "explore", "hunt for bugs", "try to break" a feature, test "what changed since last night", or for the exploratory part of a nightly or weekly QA routine. Maps the feature with Playwright MCP, then probes with scripts as different roles (admin vs user, user A vs user B) for permissions, validation, state transitions, money and date maths, concurrency, and empty or error paths.
---

# Exploratory hunt

Work inside a QA hub. Follow `CLAUDE.md`, `playbook/method.md` and `playbook/exploratory.md`.

## 0. Before you start

- `npm run sync:check`. If it fails, stop and say why.
- Know your run: a routine gives you the run id (`RUN_ID`); for an attended session start one with
  `npm run run -- start --app <app> --mode attended`.
- Know what changed: `npm run sync:tip` lists commits and files since the last tested commit. In a nightly run,
  explore **only** those areas.
- Ask the code graph first: `graphify query "<feature>" --graph graphify-out/<env>/<app>/graph.json`, then read only
  the files it points to in `apps/` (read-only).

## 1. Charters

Write one charter per area in `runs/<app>/<run-id>/charters/NN-<area>.md`: area, risk, personas, time box, sources
(requirement ids, changed files). Biggest risk first. For a routine, check the time before each charter:
`npm run run -- time-left --app <app> --run <run-id>`. Under 20 minutes, stop starting new charters.

## 2. Map

With Playwright MCP, open the feature as each role. Note every screen, field, button and API call (watch the
network requests). Write the map at the top of the session notes.

## 3. Probe

Write small scripts (Playwright `request` or the hub's `as(role)` client) to call what you mapped directly, as
different roles. Go through the list in `playbook/exploratory.md` → "Where bugs hide": permissions, validation,
state transitions, money and dates (expected values by hand first), concurrency, empty and error paths.

Name everything you create `<run-id>-…` and record it with `track()`, or by appending to
`runs/<app>/<run-id>/ledger.jsonl`, with how to undo it. Use the database only within `playbook/safety.md`
(`db.read` to confirm, `db.write` for set-up the UI cannot do, or to move dates).

## 4. Confirm and deliver

A suspicion becomes a finding only when confirmed **two ways** (response + stored state) and ruled out as "by
design" (requirement, then the app owner in `registry.yaml`). Then run the deliverable skills the hub uses:
bug-report → bug-video → regression-spec. Add each finding to `runs/<app>/<run-id>/findings.json`.

## 5. Notes

Write `qa/<app>/explore/<run-id>-<area>.md`: the map, a table of probes (expected / result), findings, and what you
did **not** reach. Add the not-reached items to `notExplored` and the covered areas to `explored` in the run's
`status.json`.

In an **attended** session, a person is watching: show them each suspicion and let them judge before you record it.
