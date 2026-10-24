# Exploratory sessions

Exploration finds the bugs nobody wrote a test for. It is time-boxed and works from a **charter**.

## Charter

```
Area:     approvals
Risk:     someone decides a request they should not be able to decide
Persona:  employee (Ben), manager (Ana), second employee (Cleo)
Time box: 45 minutes
Sources:  PRD US-3 (R4, R10), files changed since the last run
```

Charters live in `runs/<app>/<run-id>/charters/`. Session notes go to `qa/<app>/explore/<run-id>-<area>.md`.

## How a session runs

1. **Map** the feature with Playwright MCP: open it in a browser, click through as each role, note every screen,
   field, button and API call.
2. **Probe** with scripts: once you know the calls, try them directly as different roles. Admin vs ordinary user,
   user A vs user B (can A see or change B's things?).
3. **Confirm** anything odd two ways, then follow the bug lifecycle.
4. **Write the notes**: what you covered, what you found, what you did not get to (that goes to `notExplored` in the
   run's status.json, so the next run picks it up).

## Where bugs hide (check each one)

- **Permissions**: wrong role, someone else's record, own record when that is forbidden, a hidden button but an open API.
- **Validation**: empty, too long, wrong type, negative, zero, reversed ranges (end before start), duplicates.
- **State transitions**: act twice, act after cancel, act on a closed item, go back in the browser.
- **Money and dates**: rounding, weekends and holidays, month end, leap years, time zones, year boundaries. Work the
  expected value out by hand first.
- **Concurrency**: two people change the same thing; double-click; two tabs.
- **Empty and error paths**: no data yet, the server says no, the network drops halfway.

## Attended sessions

An attended session is one where a person watches and judges while Claude explores. Use it for new features and risky
areas: the person decides what is a bug and what is by design, and Claude does the clicking, scripting and evidence.
