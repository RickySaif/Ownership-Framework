---
name: e2e-suite
description: Optional deliverable. Builds a full end-to-end Playwright suite that covers 100% of an app's testable requirements (acceptance criteria), run the way users work, through the browser. It is the safety net for future refactoring - when developers restructure or rewrite the code, the suite shows at once whether any behaviour changed. Use when someone asks for "full coverage", "100% e2e", "a safety net before we refactor", "tests for every requirement", or when an app is about to be refactored, migrated or rebuilt.
---

# Full e2e suite (100% of the requirements)

Work inside a QA hub. Follow `CLAUDE.md` and `playbook/method.md`. Specs live in `qa/<app>/specs/e2e/`; run them
with `npm run e2e`; the gate is `npm run coverage -- --suite e2e --min 100`.

## Why it matters

Bug specs guard against known bugs coming back. This suite guards **everything the requirements say**. Coverage is
counted by requirement (acceptance criterion), not by lines of code: every testable rule has at least one test
that states it, end to end.

That makes it the **safety net for refactoring**. Because the tests only use the app the way a user does (pages,
buttons, the public API), not its internals, developers can restructure, rename, split, migrate or even rewrite the
code underneath. If the suite stays green, the specified behaviour survived. If something goes red, it says which
requirement broke before users notice. It also lets the owner rebuild the app with another team if they ever need
to, since the suite describes what the app must do. (Testing shows bugs are there; it never proves they are not,
so keep exploring as well.)

## 1. Start from the requirements

`qa/<app>/requirements.json` must exist and be current (spec-assurance skill). Then see the gaps:

```sh
npm run coverage -- --app <app> --suite e2e
```

## 2. Plan journeys, not single clicks

Group requirements into user journeys, one spec file per story or area (`balance.spec.mjs`, `requests.spec.mjs`,
`approvals.spec.mjs` …). For each journey:
- Map it with Playwright MCP as each role; find stable locators (`getByRole`, `getByLabel`, `getByTestId`).
- Write down the expected result of every step from the requirement first. Money and dates by hand.
- Cover the happy path **and** the rule's edges: the forbidden role, the invalid input, the boundary date, the
  second user who must not see the first user's data.

## 3. Write the tests

```js
// qa/<app>/specs/e2e/requests.spec.mjs
import { test, expect, knownBug, loginPage, named } from '../../../../lib/qa.mjs';

test('R2 an employee requests a Monday-to-Friday week and is charged 5 days', async ({ page, appName, track }) => {
  await loginPage(page, appName, 'employee');
  // … fill the form, submit, read the row, check the balance …
});
```

Rules:
- **Title starts with the requirement id(s)** it states (`R2 …`, `R1 R5 …`). The coverage gate and the board read them.
- **Black box only.** Drive the UI (and the public API where the UI cannot reach). Never import app code, call
  private endpoints, or assert on CSS classes or internal ids that a refactor could rename. Prefer roles, labels and
  test ids. This is what keeps the suite valid through refactoring.
- Assert what the requirement says, not what the app shows now. If the app is wrong, the test still states the
  requirement and carries `knownBug('<ID>', …)` (file the bug with bug-report first).
- Confirm stored state where it matters (`db.read`) as well as what the page shows.
- Each test makes its own data, named with `named()` and recorded with `track()`; no test depends on another or on
  data that existed before the run. Helpers throw on failure.
- Not for production: the suite may create data. Smoke stays the only suite allowed there.

## 4. Prove it and gate it

```sh
npm run e2e -- --app <app>                                  # green in normal mode
npm run strict-check -- --app <app>                         # every knownBug test fails on its real assertion
npm run coverage -- --app <app> --suite e2e --min 100       # every testable requirement covered
```

Requirements that truly cannot be tested end to end stay `not-testable` in `requirements.json` with a reason;
the gate leaves them out and lists them.

## 5. Keep it at 100%

- New requirement → new e2e test in the same pull request as the requirement change in the hub.
- The nightly routine runs `npm run e2e` with the other suites; red stops the line.
- Before a refactor, tell the developers: "run `npm run e2e` against your branch before and after". After the
  refactor, a green suite is the evidence that nothing specified changed.
- For an existing app with no coverage yet, cover new work fully first, then add the old requirements a few per
  week, riskiest first, until the gate passes.
