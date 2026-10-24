---
name: smoke-check
description: A fast "is it up and are the core flows alive" pass over one or all apps in a QA hub. Read-only by default and safe on any environment, including production (on synthetic accounts). Use when someone asks "is the app up", "quick check", "smoke test staging/prod", after a deploy, or as the first step of a routine.
---

# Smoke check

Work inside a QA hub. Follow `CLAUDE.md`.

1. Pick the environment: the user's choice, else `QA_ENV` from `qa.env`. Production is allowed for smoke only.
2. Run it:
   ```sh
   QA_ENV=<env> npm run smoke -- --app <app>      # or without --app for every app
   ```
   The smoke suite is in `qa/<app>/specs/smoke/` and uses `playwright.smoke.config.mjs`. It logs in each role and
   walks one core flow per role, changing nothing.
3. If there is no smoke suite yet beyond the login spec, offer the smoke-spec skill.
4. Report in plain words: up or down, which flows passed, which failed and what the page or response showed. A
   login failure usually means a missing keychain entry or a changed login page; say which.
5. Results are in `runs/<app>/<run-id>/specs-smoke.json` and the board's Runs tab after `npm run board`.

Never create, change or delete data in a smoke check. If a check needs data, it belongs in the regression suite.
