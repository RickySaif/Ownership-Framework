---
name: regression-run
description: Runs every regression spec in a QA hub and sorts the failures into new regression, known bug still open, or bug possibly fixed (a knownBug test that now passes). Use when someone asks to "run the regression", "run all tests", "did anything break", "is AL-1 fixed yet", or as the spec step of a nightly or weekly routine.
---

# Regression run

Work inside a QA hub. Follow `CLAUDE.md`.

1. `npm run sync:check`. If the checkout is not the commit the run tests, stop and say why (or `npm run sync` first
   when the user wants the latest tip).
2. Run:
   ```sh
   QA_ENV=<env> npm run regression -- --app <app>
   ```
   In a routine, `npm run run -- specs --app <app> --run <run-id>` runs smoke and regression with the run id.
3. Read the summary (also in `runs/<app>/<run-id>/specs-regression.json`). Each test is one of:
   - **passed**: fine.
   - **known-bug-open**: a `knownBug` test failed as expected; the bug is still there. Nothing to do.
   - **possibly-fixed**: a `knownBug` test passed. Check it by hand (the bug's steps and its stored state). If it
     really is fixed: in a **pull request**, set the bug's `state` to `fixed` and `fixedAt`, and remove its
     `knownBug(...)` line from the spec. Then `npm run strict-check` and `npm run validate`.
   - **new-regression** / **error**: something that used to pass now fails. **Red stops the line**: report it first.
     It counts as a regression unless a merged change or a requirement says the behaviour was meant to change; if so,
     update the spec in a pull request and link that change. Otherwise, confirm it two ways and file it with the
     bug-report skill.
   - **flaky**: passed on retry. Note it; fix the spec if it happens twice.
4. `npm run board` and report in plain words: counts, new regressions first, then possibly fixed, then known bugs.
