# Security

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private vulnerability reporting (the "Report a vulnerability"
button under the repo's **Security** tab), or contact the maintainer at [security contact]. Expect an answer within
7 days.

Useful details: what is affected (a tool, the board, a skill's instructions), how to reproduce it, and the impact.

## What this project takes care of

The framework runs tests against other people's apps with real access, so these are treated as security issues:

- a way for a hub tool or skill to **write to production**, or to write rows on a shared database that the run did
  not create;
- a way for a secret (password, token, connection string) to end up in a file, commit, bug report, video, screenshot
  or the board;
- a way for hub tooling to change the read-only app source in `apps/`;
- script injection in the board (it renders bug text and run reports);
- a published example or fixture containing real data.

## For people running a hub

- Keep your hub repo **private**: it holds evidence about your apps.
- Use synthetic test accounts with the least privilege that the tests need.
- Give the AI a read-only database role for production, or none.
- Review the pull requests your routines open before merging.
