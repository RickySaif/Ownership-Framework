---
name: prd-checklist
description: Produces the requirements coverage table for an app in a QA hub (requirement → spec → last result), and lists the requirements with no spec. Use when someone asks "what is covered", "which requirements have tests", "coverage report", or after spec-assurance to see the gaps. Coverage is counted by requirement, not by lines of code.
---

# Requirements coverage (prd-checklist)

Work inside a QA hub.

1. Make sure `qa/<app>/requirements.json` exists and is current (the spec-assurance skill writes it).
2. `npm run board`. The builder links each requirement id to every spec test whose title contains it (`R4 …`) and
   to the latest result of that test. It writes `board/data/coverage.json` and the board's **Coverage** tab.
3. Report:
   - covered: requirements with at least one spec, and their last result;
   - **gaps**: requirements with no spec: propose a regression spec for each testable one, highest risk first;
   - not testable: the reason, and who could unblock it.
4. If the user wants a file, write `qa/<app>/coverage.md` with the table (Requirement · Rule · Spec · Last result ·
   Verdict).

The goal is every testable requirement covered by a spec that states it. New features: cover them as they land;
old ones: add coverage a little every week.
