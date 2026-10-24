# FAQ

**Do I need to know how to program?**
No. The skills interview you in plain language and do the scripting. You need to know the app: who uses it, what it
should do, and where its requirements are. It helps to be comfortable running a command that Claude gives you.

**Does it change the app's code?**
Never. The hub downloads the source read-only so Claude can understand it. Fixes happen in the app's own repo; the
hub gives developers a fix prompt, a video and a failing-when-strict spec.

**Why is the hub a separate repo?**
So QA owns its evidence, can test several apps, and can keep testing when an app changes hands. It also keeps test
accounts, videos and run history out of the app's repo.

**Which apps can it test?**
Web apps reachable from a browser, with code on GitHub or GitLab (or a local folder). Databases: PostgreSQL,
MySQL/MariaDB and SQLite.

**What is `knownBug`?**
A marker on a test that states the correct behaviour while the bug is still there. The test is expected to fail, so
the suite stays green. When developers fix the bug the test passes, and the next run says "possibly fixed".
`npm run strict-check` proves each such test really fails on its assertion (not on a setup error).

**Is it safe to point at staging? At production?**
Staging, yes: the AI only writes rows its own run created, in small logged transactions. Production gets a read-only
smoke check on synthetic accounts and nothing else, unless someone approves a written, time-boxed exception. See
[safety.md](safety.md).

**Where do passwords go?**
In the OS keychain (or CI secrets). Files only hold the name of the keychain entry or environment variable.

**Can I try it without any app of my own?**
Yes: the README's quick start runs the included Acme Leave demo app and its example hub offline.

**What does it cost?**
The framework is free (MIT for code, CC BY 4.0 for the method and docs). Running it uses your Claude Code plan or API
usage.

**Can I adapt it for my clients?**
Yes, under the licences (see [licensing.md](licensing.md)). The name, logo and any certification titles are
trademarks and are not covered by the licences.
