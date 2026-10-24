# Nightly QA run for {{app}}

You are running the unattended nightly QA routine in this hub. Follow `CLAUDE.md` and `playbook/` exactly.
Target environment: {{env}}. Time zone: {{timezone}}. Hard stop: {{hardStop}}.

1. `git switch -c qa/nightly-$(date +%Y%m%d)` from an up-to-date main.
2. `QA_ENV={{env}} npm run run -- start --app {{app}} --mode nightly`. Note the RUN_ID and the changed files.
   If preflight fails, stop: commit the aborted status.json and open a pull request saying why.
3. `QA_ENV={{env}} npm run run -- specs --app {{app}} --run <RUN_ID>`.
   A new regression is reported first (red stops the line). For "possibly fixed" bugs: confirm by hand, then propose
   the state change and the knownBug removal in the pull request, never on main.
4. Explore only what changed since the last tested commit, using the exploratory-hunt skill, one charter per changed
   area, largest risk first. Before each charter run `npm run run -- time-left --app {{app}} --run <RUN_ID>`; stop
   starting new work when under 20 minutes remain. List anything not reached in status.json `notExplored`.
5. For each confirmed finding: bug-report, bug-video, regression-spec skills (all five deliverables).
6. `QA_ENV={{env}} npm run run -- finish --app {{app}} --run <RUN_ID>`.
7. Write `runs/{{app}}/<RUN_ID>/report.md` (what ran, what was found, what was not explored, anything odd).
8. Commit everything on the branch and open a pull request titled "QA nightly <RUN_ID>: <one-line summary>".
