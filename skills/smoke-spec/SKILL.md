---
name: smoke-spec
description: Writes a short, read-only Playwright smoke suite for an app in a QA hub: login per role, main navigation, and one core flow per role, with its own Playwright config, safe to run against any environment including production. Use when setting up a new app, when someone asks for "a quick check we can run anywhere", or after the smoke-check skill finds no suite.
---

# Smoke spec

Work inside a QA hub. Smoke specs live in `qa/<app>/specs/smoke/` and run with `playwright.smoke.config.mjs`
(`npm run smoke`). `ownership-setup` already generated `login.spec.mjs` (every role can log in).

1. Map the app with Playwright MCP as each role: the main navigation and the one flow each role uses most.
2. Write `qa/<app>/specs/smoke/core-flows.spec.mjs`:
   - `the app is up`: the health or home page answers 200.
   - per role: log in with `loginPage(page, appName, '<role>')`, open the main pages, check each shows its key element
     (a heading, a table, a balance), and check what the role must **not** see is hidden.
   - Prefer `getByRole` / `getByTestId` locators. Keep each test under ~10 seconds.
3. **Read-only.** No form submits that save, no deletes, no `track()`, no `db.write`. If a flow needs data, it belongs
   in the regression suite. Production smoke uses synthetic accounts only.
4. Run it against two environments (`QA_ENV=local npm run smoke`, `QA_ENV=staging npm run smoke`). Both must pass
   before you commit.

Example: `examples/acme-leave/hub/qa/acme-leave/specs/smoke/` in the framework.
