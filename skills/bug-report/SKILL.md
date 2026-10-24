---
name: bug-report
description: Writes a complete, validated bug file (qa/<app>/bugs/<ID>.json) for a confirmed bug in a QA hub: title, severity, area, summary, steps, expected (with the requirement link), actual, where in the code, how it was confirmed (response + stored state), state, fix hint, links to video and spec. Use when a bug has been found and confirmed, or someone says "file this bug", "write it up", "report AL-4".
---

# Bug report

Work inside a QA hub. Follow `CLAUDE.md` and `playbook/bug-lifecycle.md`. Schema: `schemas/bug.schema.json`.

## Before writing

- The bug must be **confirmed two ways**: the response (UI text, or API status and body) **and** the stored state
  (API read-back or a read-only query with `db.read`). If you only have one, go get the other.
- Rule out "by design": quote the requirement; if it is ambiguous, ask the app owner in `registry.yaml` and record
  the answer in `how.byDesignCheck`. If it is by design, still write the file with `state: "by-design"` so nobody
  reports it again.
- Check for duplicates in `qa/<app>/bugs/` (same area and behaviour). Link related bugs in `related`.

## Writing it

- **id**: the app's `prefix` from `registry.yaml` plus the next free number (`AL-4`). File name = `<id>.json`.
- **title**: what is wrong, in user words ("An employee can approve their own leave request").
- **sev**: `critical` (data loss, security, money wrong for many, app unusable), `high` (a core rule broken, wrong
  money or dates, permission hole), `medium` (wrong but with a workaround, or limited reach), `low` (cosmetic, rare).
- **summary**: two or three sentences a non-programmer understands, including who it hurts.
- **steps**: numbered, from a fresh login, with the exact data used.
- **expected**: `text` from the requirement (money and dates worked out by hand, showing the working),
  `requirement` id, `link` to the story.
- **actual**: what happened, with the numbers.
- **where**: file and function, if the code graph and source show it (`graphify query`, then read the file in
  `apps/`). Leave it out rather than guess.
- **how**: `response` and `state`, each with the exact call or query and what came back.
- **hint**: one or two sentences on the fix, for the fix prompt. Point at a pattern already in the code if there is one.
- **prd**, **spec**, **video**: fill in as those deliverables are made (bug-video, regression-spec).
- **environment**: env and commit (from `qa/<app>/source-version.json`). **foundAt**: today. **run**: the run id.
- **state**: `open`.

Never put secrets, real customer data or a real person's details in a bug file.

## After writing

```sh
npm run validate
```

Fix anything it reports. Then go on to bug-video and regression-spec (if the hub uses them) and `npm run board`.
