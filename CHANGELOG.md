# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Optional deliverable **full e2e suite** (`e2e-suite` skill): end-to-end tests for 100% of an app's testable
  requirements, the safety net for future refactoring. New `npm run e2e` and the coverage gate
  `npm run coverage -- --suite e2e --min 100`; routines run it nightly and strict-check covers it.
- The Acme Leave example has a full e2e suite: 13 browser journeys covering R1-R10 (100%), checked in CI.

### Fixed
- The board's coverage table now matches test titles that contain quotes.

## [0.1.0] - 2026-10-25

### Added
- Claude Code plugin and marketplace entry with twelve skills: ownership-setup, spec-assurance, exploratory-hunt,
  smoke-check, regression-run, bug-report, bug-video, regression-spec, smoke-spec, board, prd-checklist,
  routine-setup.
- QA hub templates: tools (init, sync with tip and deployed modes, sync:check, specs runner with failure sorting,
  strict-check, ledger and cleanup, guarded database access for PostgreSQL, MySQL/MariaDB and SQLite, validate,
  board builder, routine phases, local bring-up), spec library with `knownBug`, captioned video harness, schemas,
  playbook, routine prompts, scheduler examples and a permissions file for unattended runs.
- Acme Leave: a fictional, dependency-free demo app with three seeded bugs, and an example hub with all deliverables,
  a sample nightly run and a built board.
- README visuals rendered from source (`npm run visuals`), light and dark.
- Secret scan before every commit, and CI for lint, secret scan (full history), template check, schema validation,
  and the example's specs in normal and strict mode.
