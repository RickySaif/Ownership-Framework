<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/hero-dark.png">
  <img alt="Ownership Framework: own the quality of the apps you depend on. A key-and-check logo, and a sketch of two app windows feeding a QA hub, which feeds a results board with red, amber and green cards and a video." src="docs/visuals/out/hero-light.png" width="100%">
</picture>

**Claude Code skills that set up and run your own QA hub**: a git repo, separate from the apps it tests, that
holds the bugs, captioned videos, test specs, run status and a results board for one or more web apps. Built so
that one person, even one who does not program, can own the quality of the apps they depend on.

## Try it in 3 commands

Runs offline against the included demo app, **Acme Leave** (fictional), with three seeded bugs. Needs Node 22.13 or
newer and git.

```sh
git clone https://github.com/RickySaif/Ownership-Framework.git && cd Ownership-Framework
npm ci && npx playwright install chromium
npm run example      # syncs the demo app, runs every spec, builds the board
```

Then open `examples/acme-leave/hub/board/index.html` in your browser.

## Use it on your own apps

In Claude Code:

```text
/plugin marketplace add RickySaif/Ownership-Framework
/plugin install ownership-framework@ownership-framework
```

Then say **"set up a QA hub"**. The `ownership-setup` skill asks one plain question at a time (which apps, where
the requirements are, test accounts, environments, which tests and deliverables, routines), generates the hub,
installs Playwright, Playwright MCP, Graphify and ffmpeg, downloads each app's source read-only, runs a first smoke
check and shows you the result.

## How it fits together

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/architecture-dark.png">
  <img alt="Architecture: app repos (tip of each branch, GitHub or GitLab) are downloaded into a read-only apps folder, which feeds a Graphify code graph. Four test skills (spec assurance, exploratory hunt, smoke check, regression run) run Playwright against local, dev and staging, with guarded database access, and smoke-only on production. Each bug gets a bug file, captioned video, regression spec with knownBug, fix prompt and requirement map, all shown on the board. Nightly and weekly routines run the loop." src="docs/visuals/out/architecture-light.png" width="100%">
</picture>

## The five deliverables of a bug

Every confirmed bug ends up as five things, so a developer (or a coding agent) can fix it without a meeting:

1. **Bug file** `qa/<app>/bugs/<ID>.json`: steps, expected (linked to the requirement), actual, where in the code,
   and how it was confirmed: the response **and** the stored state.
2. **Captioned video**: the steps recorded headless, with captions and an evidence panel.
3. **Regression spec** that states the *correct* behaviour, wrapped in `knownBug('<ID>')` so the suite stays green
   until the fix lands, then flips. Each one is proven: in strict mode it must fail on its real assertion.
4. **Fix prompt** for a coding agent: which file and function, why it is wrong, the fix, which spec must turn green.
5. **Board**: everything on one page, with filters, the video, and a copy-fix-prompt button.

```mermaid
flowchart LR
  A["Suspect<br/>something looks wrong"] --> B["Confirmed two ways<br/>response + stored state"]
  B --> C{"By design?<br/>requirement, then app owner"}
  C -- yes --> D["Record as by-design<br/>so nobody re-reports it"]
  C -- no --> E["Five deliverables<br/>bug file · video · spec with knownBug<br/>fix prompt · board"]
  E --> F["Developers fix it<br/>in the app's own repo"]
  F --> G["Next run: possibly fixed<br/>knownBug test passes"]
  G --> H["Pull request: state fixed,<br/>marker removed, spec guards it"]
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/board-bug-detail-dark.png">
  <img alt="Screenshot of the example board: bug AL-2 'Weekend days are charged as leave' selected, with severity and state pills, a Copy fix prompt button, and the captioned video showing an evidence panel: expected 2 working days, shown 4 days." src="docs/visuals/out/board-bug-detail-light.png" width="100%">
</picture>

<table>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/board-bugs-dark.png">
        <img alt="Board, Bugs tab: latest-run banner (complete, nightly, three new findings) above a filtered list of the three open Acme Leave bugs." src="docs/visuals/out/board-bugs-light.png">
      </picture>
    </td>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/board-runs-dark.png">
        <img alt="Board, Runs tab: the sample nightly run with versions, spec results (smoke 6 passed, regression 10 passed and 4 known bugs), new findings, what was not explored, and the run report." src="docs/visuals/out/board-runs-light.png">
      </picture>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <img alt="One frame of the captioned AL-1 video: Acme Leave's My leave page with an approved request, an 'AL-1 · bug' badge, and an evidence panel: expected HTTP 403 and still pending, API response HTTP 200 approved, stored status approved, decided by Ben himself." src="docs/visuals/out/video-frame.png">
    </td>
  </tr>
</table>

## Pick your setup

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/setup-matrix-dark.png">
  <img alt="Matrix of test types by routine. Spec assurance: weekly one area, attended any area. Exploratory hunt: nightly the diff only, weekly deep on one area, attended with a person judging. Smoke check: always, every routine. Regression run: all specs nightly and weekly, on demand when attended. Deliverables to choose: bug file, captioned video, regression spec, smoke suite, board, and optionally a coverage table." src="docs/visuals/out/setup-matrix-light.png" width="100%">
</picture>

| Skill | What it does |
|---|---|
| `ownership-setup` | **Start here.** Interviews you, generates the hub, installs the tools, runs a first smoke check |
| `spec-assurance` | Turns the requirements into a checklist of testable rules and checks each: pass, fail (bug) or not testable |
| `exploratory-hunt` | Time-boxed bug hunting from charters, as different roles: permissions, validation, states, money and dates, concurrency, empty and error paths |
| `smoke-check` | Fast, read-only "is it up and are the core flows alive", safe on any environment |
| `regression-run` | Runs every spec and sorts failures: new regression, known bug still open, or possibly fixed |
| `bug-report` | Writes the bug file, confirmed two ways and validated against the schema |
| `bug-video` | Records the captioned video with an evidence panel, plus an optional after-fix clip |
| `regression-spec` | Writes the spec of the correct behaviour with `knownBug`, and proves it with strict-check |
| `smoke-spec` | Writes a short, read-only smoke suite per app with its own Playwright config |
| `board` | Builds and publishes the board, with a fix prompt per bug |
| `prd-checklist` | Coverage by requirement: requirement → spec → last result, and the gaps |
| `routine-setup` | Schedules nightly and weekly runs with a least-privilege permissions file |

## A routine on a timeline

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/nightly-timeline-dark.png">
  <img alt="Nightly run timeline from 01:30 to a hard stop at 06:00: preflight (sync the tip, sync check, login check), all specs, exploring only what changed since the last tested commit until about 04:50, wrapping up findings, cleanup from the ledger at 05:30, board rebuild. A new regression stops the line; anything not reached by the hard stop is recorded as not explored." src="docs/visuals/out/nightly-timeline-light.png" width="100%">
</picture>

Routines run as Claude Code scheduled agents (`/schedule`), with cron or launchd on a machine your team owns, or on
a CI schedule. They commit to a branch and open a pull request: changes to specs, `knownBug` markers or bug states
never go straight to main. See [docs/routines.md](docs/routines.md).

## Safety by environment

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/visuals/out/safety-dark.png">
  <img alt="Safety table. Local: read everything, write everything (free to reset, only when QA_ISOLATED_DB names the local database), approved by you. Dev and staging: reads always fine; writes only to rows the run created, in one transaction with a row cap and before/after logged; unattended runs snapshot first or rely on a nightly restore; approved by the app owner. Production: smoke on synthetic accounts only, never written by the AI, exceptions only written and time-boxed in CLAUDE.md." src="docs/visuals/out/safety-light.png" width="100%">
</picture>

The tools enforce these rules rather than trusting them: see [docs/safety.md](docs/safety.md).

## What is in this repo

```text
.claude-plugin/        plugin.json and marketplace.json
skills/<name>/         one folder per skill (SKILL.md, plus the hub generator in ownership-setup/)
templates/hub/         what ownership-setup copies into a hub: tools/, lib/, schemas/, board/, playbook/, routines/
examples/acme-leave/   app/: the fictional demo app · hub/: a generated hub with 3 bugs, all deliverables, a run, a board
docs/                  method, safety, routines, FAQ, licensing · visuals/: sources for every image in this README
```

Rebuild every image from source with `npm run visuals`. Run all checks with `npm test`.

## Docs

[Method](docs/method.md) · [Safety](docs/safety.md) · [Routines](docs/routines.md) · [FAQ](docs/faq.md) ·
[Licensing](docs/licensing.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
[Changelog](CHANGELOG.md)

## Licence

Code: [MIT](LICENSE). Method, docs and diagrams: [CC BY 4.0](LICENSE-docs). The name, logo and certification titles
are trademarks and are not covered by either licence: see [TRADEMARKS.md](TRADEMARKS.md). © 2026 Ricky Saif.
