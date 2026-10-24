---
name: board
description: Builds and publishes the QA hub's results board, a single HTML page with the bug list and filters, video player, requirement links, a "copy fix prompt" button per bug, a Runs tab with the latest-run banner, and a coverage table. Use when someone asks to "show the board", "update the board", "publish the results", "share the bugs with developers", or "give me the fix prompt for AL-2".
---

# Board

Work inside a QA hub. Builder: `tools/build-board.mjs`; page template: `board/template.html`.

## Build

```sh
npm run board          # board/data/*.json and board/index.html (open it in a browser)
npm run board:dist     # also board/dist/: index.html plus the videos, ready to publish
```

The board shows:
- **Bugs**: filters (app, severity, state, search), and for each bug the summary, video, steps, expected (with the
  requirement link), actual, how it was confirmed, where in the code, and **Copy fix prompt**.
- **Runs**: a "latest run" banner and every run: mode, environment, versions, spec results, new findings, possibly
  fixed, not explored, and the latest report.
- **Coverage**: requirement → spec → last result, plus the spec-assurance verdict.

## The fix prompt

Assembled per bug for a coding agent: the repo and branch, the file and function, why it is wrong (requirement vs
actual), how it was confirmed, the steps, the fix hint, and which spec must turn green. Give it to developers as is:
"Copy fix prompt" on the board, or read it from `board/data/bugs.json` → `fixPrompt`.

## Publish

Ask before publishing: a board shows evidence about an app, so it should stay private unless the owner agrees.

- **Claude Artifact** (private by default): `npm run board:dist`, then publish `board/dist/index.html` with the
  videos in `board/dist/videos/` as supporting files.
- **GitHub Pages**: `npm run board:dist`, then publish `board/dist/` (for example with
  `actions/upload-pages-artifact` + `actions/deploy-pages`). Use a private repo with access control if the board is
  not meant to be public.
- **Local**: open `board/index.html`.
