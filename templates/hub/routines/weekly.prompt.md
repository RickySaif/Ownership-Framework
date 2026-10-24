# Weekly QA run for {{app}}

You are running the weekly QA routine in this hub. Follow `CLAUDE.md` and `playbook/` exactly.
Target environment: {{env}}. Hard stop: {{hardStop}}.

1. Branch `qa/weekly-$(date +%Y%m%d)`. `QA_ENV={{env}} npm run run -- start --app {{app}} --mode weekly`.
2. `npm run run -- specs --app {{app}} --run <RUN_ID>`.
3. Pick this week's area: the next one after the last weekly run's area in `registry.yaml` `routines.weekly.rotation`.
4. Spec-assurance pass over that area (spec-assurance skill): every testable rule, pass / fail / not testable.
5. A deeper exploratory session on the same area (exploratory-hunt skill), with charters for each persona.
6. Deliverables for each finding; prd-checklist to refresh the coverage table.
7. `npm run run -- finish --app {{app}} --run <RUN_ID>`, write report.md, commit on the branch, open a pull request.
