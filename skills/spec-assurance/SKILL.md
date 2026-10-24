---
name: spec-assurance
description: Checks a running app against its written requirements. Use when someone asks "does the app do what the PRD says", "check the user stories", "verify the requirements", or for the weekly spec-assurance pass in a QA hub. Reads PRDs, user stories, a wiki, Markdown in the repo, or a URL; builds a checklist of testable rules each linked to its story; checks every rule; marks it pass, fail (a bug) or not testable (with the reason).
---

# Spec assurance

Work inside a QA hub (a repo with `registry.yaml` and `CLAUDE.md`). Follow `CLAUDE.md` and `playbook/method.md`.

## 1. Read the requirements

Sources are in `registry.yaml` → `apps.<app>.requirements` (or the user gives a link or a file). Read them fully. For
a weekly pass, take only the area named in the routine.

## 2. Build the checklist

Write `qa/<app>/requirements.json` (keep rules already there; update their text if the source changed):

```json
{ "app": "acme-leave", "source": "<where>", "checkedAt": "YYYY-MM-DD",
  "rules": [ { "id": "R2", "story": "US-2 Request leave", "link": "<url or repo path#anchor>",
               "text": "Only Monday to Friday count", "verdict": null } ] }
```

- One rule = one thing you can check with a yes or no. Split rules that say two things.
- Keep the source's ids when it has them; otherwise number them R1, R2 … in order.
- Write `text` in plain words, short. Keep the link to the story so anyone can read the original.

## 3. Check each rule against the running app

For each rule, before looking at the app, write down the expected result. For money and dates, work it out by hand.
Then check it with the app's UI (Playwright MCP) or API, as the right role. Confirm anything odd two ways (response
plus stored state, see `playbook/bug-lifecycle.md`).

Set `verdict` to:
- `pass`: the app does what the rule says.
- `fail`: it does not. Add `"bug": "<ID>"` and run the bug-report skill (and the other deliverables the hub uses).
- `not-testable`: add `"reason"` (for example "needs a payment provider we cannot reach on staging", "the rule is
  ambiguous: asked <owner> on <date>").

## 4. Report

Summarise: how many rules, how many pass / fail / not testable, the bugs filed, and the ambiguous rules with the
question for the app owner. Run `npm run board` so the Coverage tab shows the new verdicts.
