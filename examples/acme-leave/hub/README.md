# Acme QA Hub

A QA hub for acme-leave: bugs, captioned videos, test specs, run status and a results board, kept separate from
the apps' own repos. Built with the Ownership Framework QA skills.

## Run it

```sh
npm run init          # install and check Playwright, browsers, Playwright MCP, Graphify, ffmpeg, DB clients
npm run sync          # download each app's source (tip of its branch) into apps/, read-only
npm run smoke         # quick read-only check that each app is up and its core flows work
npm run regression    # every regression spec; failures sorted into new / known bug / possibly fixed
npm run board         # build board/index.html; open it in a browser
```

Target another environment with `QA_ENV=staging npm run smoke` (production: smoke only).

| Command | What it does |
|---|---|
| `npm run sync -- --deployed` | Check out the commit the environment actually runs, not the branch tip |
| `npm run sync:tip` | Show how far the tip is ahead of what was last tested, without checking anything out |
| `npm run sync:check` | Stop if the checkout is not the commit the run says it tests |
| `npm run e2e` | The full end-to-end suite: every requirement, run as a user would. The safety net for refactoring |
| `npm run coverage -- --suite e2e --min 100` | Fails unless every testable requirement has an e2e test |
| `npm run strict-check` | Prove each knownBug spec fails on its real assertion when strict, and passes otherwise |
| `npm run videos` | Record the captioned bug videos |
| `npm run validate` | Check bug files and run records against the schemas |
| `npm run cleanup -- --app <app> --run <id>` | Undo what a run created, from its ledger only |
| `npm run local:up` | Bring local copies of the apps up (Docker Compose or the app's setup steps) |

## Publish the board

Run `npm run board:dist` and publish `board/dist/` with GitHub Pages (Settings → Pages), or ask Claude to use the board skill.

## How it works

Read `playbook/` (start with `playbook/method.md`). Rules for Claude are in `CLAUDE.md`.
