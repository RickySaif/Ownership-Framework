# Contributing

Thank you for helping. Issues and pull requests are welcome.

## Ground rules

- **Fictional data only.** Examples, fixtures, screenshots and videos use the fictional Acme Leave app
  (`*.acme.example`). Never add real company names, hosts, people, credentials, tokens or customer data, not even in
  a commit message.
- **The secret scan runs before every commit.** `npm install` turns on the pre-commit hook
  (`scripts/secret-scan.mjs`, plus gitleaks if installed). Do not bypass it with `--no-verify`. If you have
  private words that must never be published (your employer's name, internal hosts), put them one per line in
  `.secret-scan-deny.local`; that file is ignored by git.
- **Pin exact versions** of every dependency (`.npmrc` has `save-exact=true`).
- **Plain English** in skills and docs, for a reader who does not program. Short sentences; say what a command does.

## Setup

```sh
npm ci
npx playwright install chromium
npm test            # lint, secret scan, template check, example validate, specs (normal and strict)
npm run visuals     # rebuild every README image from source
```

## Changing the hub templates

Hub files live in `templates/hub/`. The example hub in `examples/acme-leave/hub/` is generated from them, and CI
checks they match. After changing a template:

```sh
node skills/ownership-setup/scripts/generate-hub.mjs --answers examples/acme-leave/answers.json --out examples/acme-leave/hub --update
npm test
```

If the change affects the board or the videos, also run `npm run example:videos`, `npm run example:board` and
`npm run visuals`, and check the screenshots.

## Pull requests

One topic per pull request. Describe what changed and how you checked it. Add a line to `CHANGELOG.md` under
"Unreleased". By contributing you agree your contribution is licensed under the repo's licences (MIT for code,
CC BY 4.0 for docs and method).
