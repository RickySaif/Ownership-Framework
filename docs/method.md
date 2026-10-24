# The method

The Ownership Framework's QA skills help one person, even one who does not program, **own the quality of the web
apps they depend on**: test them from the outside, keep evidence, and hand developers everything they need to fix
what is wrong.

The full method is in the hub playbook, which every hub gets a copy of and can change:

| Page | What it covers |
|---|---|
| [method.md](../templates/hub/playbook/method.md) | The nine rules every test follows, the five deliverables, reading code through the graph |
| [bug-lifecycle.md](../templates/hub/playbook/bug-lifecycle.md) | Suspect → confirmed two ways → not by design → deliverables → fixed → spec flips green |
| [exploratory.md](../templates/hub/playbook/exploratory.md) | Charters, mapping, probing, where bugs hide, attended sessions |
| [safety.md](../templates/hub/playbook/safety.md) | What may be done in each environment, database rules, data rules |
| [routines.md](../templates/hub/playbook/routines.md) | Nightly, weekly and attended runs, and how to schedule them |

## The ideas in one page

- **A hub, separate from the apps.** The hub repo holds bugs, videos, specs, run records and the board. The apps'
  source is downloaded read-only into `apps/` so Claude can read it, never change it.
- **Requirements decide what is right.** Not the app's current behaviour, and not the tester's taste. Money and
  dates are worked out by hand before looking.
- **Two ways, or it is not a bug yet.** The response and the stored state must both show it.
- **Five deliverables per bug.** A bug file, a captioned video, a regression spec of the correct behaviour (kept
  green with `knownBug` until the fix), a fix prompt, and the board.
- **Specs that prove themselves.** Every `knownBug` spec must fail on its real assertion in strict mode. A test that
  cannot fail is worse than no test.
- **Only touch what you made.** Every run keeps a ledger; cleanup reads only the ledger.
- **Proof every night.** A routine syncs the latest code, runs every spec, explores only what changed, and reports.
  Red stops the line: a new regression is dealt with before new work, and every bug that reached users becomes a spec.
- **Coverage by requirement.** The question is "which rules have a spec that states them", not "how many lines ran".
  Testing shows bugs are there; it never proves they are not, so keep exploring.
