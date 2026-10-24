# The ownership-setup interview

Ask in this order, one question at a time. Defaults are in **bold**. Keys refer to `answers.json`.

## About the hub

1. "What should we call your QA hub?" (**"<Company> QA Hub"**) → `hubName`; `hubSlug` = lower-case, dashes.
2. "Which time zone are you in? Nightly runs and reports use it." (**the machine's time zone**) → `timezone`.

## Apps to test (repeat per app)

3. "Which app do you want to test first? A short name is fine." → `apps[].name` (lower-case, dashes).
   Bug ids use a prefix: suggest the initials (**"AL" for acme-leave**) → `prefix`.
4. "Where is its code? Paste the repo link." → `repo.url`; `provider` = github or gitlab from the link.
   "Which branch do developers push to?" (**main**) → `repo.branch`.
   If the repo is private: "Is there a read-only token for it? Put it in the keychain as
   `qa-hub/<app>/repo-token`; I'll only store that name." → `repo.token = { keychain, env }`.
5. "Who owns this app, the person who decides what is a bug and what is by design?" → `owner.name`, `owner.contact`.
6. "Which environments can we test? For each: its web address." Offer **local**, **dev**, **staging**; ask about
   production last and say it will be smoke-only. → `environments.<env>.url`.
   For local: "How is it started? Docker Compose, a command, or not at all?" → `environments.local.setup`
   (`compose`, `steps`, `migrate`, `seed`) and `start` if Playwright should start it.
7. "Does the app show its version somewhere, like /version?" (**no**) → `version.path`, `version.field`.

## Requirements

8. "Where are the requirements: PRDs, user stories, a wiki, Markdown in the repo, or a link?" →
   `requirements[] = { type, location }`. If none: say spec-assurance will work from what they describe, and that
   expected behaviour must still come from someone's written word, not from what the app does.

## Accounts

9. "Which kinds of users does the app have? For example admin, manager, employee." (**admin, user**) → roles.
   For each role: "What is the e-mail or user name of its test account?" → `testAccounts.roles.<role>.user`.
   Then tell them how to store the password (macOS: `security add-generic-password -s qa-hub/<app>/<role> -a <user> -w`)
   and record `password: { keychain: "qa-hub/<app>/<role>", env: "<APP>_<ROLE>_PASSWORD" }`.
   Ask for a second account of the same role if they have one (user A vs user B tests).
10. "How does someone log in? I can look at the login page myself if you like." → `login.ui` (selectors) and,
    if there is a login API, `login.api`. Use Playwright MCP to find the selectors when they don't know.

## Databases (per environment, skip any they don't know)

11. "Can we reach the <env> database? Which kind: PostgreSQL, MySQL/MariaDB or SQLite?" → `db.engine`.
    "Host, port and database name?" → `db.host`, `db.port`, `db.name` (or `db.file` for SQLite).
    "Read only, or may we write to rows our tests create?" (**local: read-write; dev/staging: read-write on our own
    rows; prod: none**) → `db.access`.
    "Is it behind an SSH jump host or a VPN?" → `db.tunnel = { via, localPort }` or `db.vpn`.
    "Does <env> reset itself every night?" (**no**) → `db.restoresNightly`.
    Credentials: keychain references only (`db.user`, `db.password`).

## What the hub does

12. "Which kinds of testing do you want?" (**all four**): spec-assurance, exploratory-hunt, smoke-check,
    regression-run → `testTypes`.
13. "For each bug, which deliverables?" (**bug file, video, regression spec, board**; smoke suite and coverage table
    optional) → `deliverables`.
    Then: "Do you also want a full end-to-end suite that covers 100% of the requirements? It takes longer to build,
    but it becomes a safety net: when developers refactor the code later, it shows straight away if any behaviour
    changed." (**yes if the app will be refactored or rebuilt; otherwise later**) → add `e2e-suite`.
14. "Should it run by itself? Nightly, weekly, both, or only when you ask?" (**nightly 01:30 with a 06:00 hard stop,
    weekly Saturday 09:00, on staging**) → `apps[].routines`. The routine-setup skill schedules them later.
15. "Production: smoke-only on test accounts, or not at all?" (**smoke-only**) → `production.policy`. Exceptions only
    with approver, scope and end date → `production.exceptions`.
16. "Where should the board live? Just on this computer, a private Claude Artifact, or GitHub Pages?"
    (**this computer**) → `board.publish` = local | artifact | pages.

Read the whole set of answers back in a short summary and ask "Shall I create the hub?" before generating.
