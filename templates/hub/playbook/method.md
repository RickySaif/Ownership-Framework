# The method

The hub exists so you can **own the quality of the apps you depend on**, even if you did not build them and cannot
change their code. You test from the outside, keep evidence, and hand developers everything they need to fix it.

## The rules every test follows

1. **Expected behaviour comes from the requirements, not from what the app shows now.** Read the story or PRD first
   and write down what should happen. Only then look at the app. For money and dates, work the expected value out by
   hand (or in a spreadsheet) *before* you look at the app's answer, and write the working into the bug or spec.
2. **Confirm a suspected bug two ways.** What the app *said* (the UI or the API response) and what it *stored* (read
   back through the API, or with a read-only database query). One way is a suspicion; two ways is a finding.
3. **Rule out "by design".** Before recording a bug, check the requirement again, and when it is unclear ask the app
   owner named in `registry.yaml`. Write who you asked and what they said in the bug's `how.byDesignCheck`.
4. **Helpers throw on failure.** Setup code that cannot do its job stops the test with a clear `[helper]` error. No
   assertion that cannot fail, no `|| true`, no swallowed errors. A broken setup must never look like a pass or a bug.
5. **Only change what you created.** Everything a run creates is named `<run-id>-…` and recorded in
   `runs/<app>/<run-id>/ledger.jsonl`. Cleanup reads only the ledger. Never edit or delete data that existed before
   the run.
6. **Targets are local, dev or staging.** Production gets a read-only smoke check on synthetic accounts, nothing more,
   unless `CLAUDE.md` records a written, time-boxed exception (who approved it, the scope, the end date).
7. **App source is read-only.** `apps/` holds downloaded copies to read and to query through the code graph. Nothing in
   the hub edits or commits there. Fixes happen in the app's own repo, by its developers.
8. **Red stops the line.** A new regression is reported before any new exploratory work. Every bug that escaped to
   users becomes a regression spec, so it cannot come back unnoticed.
9. **Coverage is counted by requirement**, not by lines of code: every testable rule should have a spec that states
   it. Testing shows the presence of bugs, never their absence, so keep exploring too.

## The five deliverables of a bug

When a bug is confirmed, the hub produces, in this order:

1. **Bug file** `qa/<app>/bugs/<ID>.json`: what, where, expected (with the requirement), actual, how it was confirmed.
2. **Captioned video** `qa/<app>/videos/<ID>-<slug>.webm`: the steps, recorded headless, with captions and an
   evidence panel showing the response and the stored state.
3. **Regression spec**: a Playwright test of the *correct* behaviour, wrapped in `knownBug('<ID>', …)` while the bug
   is open. The suite stays green; when the bug is fixed the test passes and the run says "possibly fixed".
4. **Fix prompt**: assembled on the board for a coding agent: the file and function, why it is wrong, the fix, and
   which spec must turn green.
5. **Board**: everything above on one page, with filters, the video player and a "copy fix prompt" button.

## Reading code

Before reading an app's source, ask the code graph: `graphify query "<question>" --graph graphify-out/<env>/<app>/graph.json`.
It points you at the right files, so you read less and miss less. Then open only those files in `apps/`.
