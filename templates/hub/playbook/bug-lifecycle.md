# The bug lifecycle

```
suspect ──▶ confirmed two ways ──▶ not by design? ──▶ five deliverables ──▶ fixed ──▶ spec flips green
            (response + stored)    (requirement,      (file, video, spec,    (in the     (knownBug removed
                                    then app owner)    fix prompt, board)     app repo)   by pull request)
```

1. **Suspect.** Something looks wrong. Write down what the requirement says should happen. For money and dates,
   work out the expected value by hand first.
2. **Confirm two ways.** Capture the response (UI text or API body and status) *and* the stored state (API read-back
   or a read-only DB query). If they disagree with the requirement, it is a finding.
3. **Rule out "by design".** Re-read the requirement. If it is ambiguous, ask the app owner in `registry.yaml` and
   record the answer. Only then write the bug.
4. **Deliver** (the bug-report, bug-video, regression-spec and board skills):
   - `qa/<app>/bugs/<ID>.json` (validated by `npm run validate`)
   - `qa/<app>/videos/<ID>-<slug>.webm`
   - a spec in `qa/<app>/specs/regression/` wrapped in `knownBug('<ID>', 'reason')`, checked with `npm run strict-check`
   - `npm run board` for the fix prompt and the board
5. **Fixed.** Developers fix it in the app's repo. On the next run the knownBug test passes, so the run lists the bug as
   **possibly fixed**. A person confirms it, then a pull request in the hub sets `state: "fixed"` and `fixedAt`, and
   removes the `knownBug` marker. From then on the spec guards against the bug coming back.

States: `open`, `fixed`, `wontfix` (the owner decided not to fix it), `by-design` (the requirement says it is correct;
keep the file so nobody reports it again).

A failing spec counts as a **regression** unless a merged change or a requirement says the behaviour was meant to
change. If it was, update the spec in a pull request and link the change.
