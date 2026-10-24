#!/usr/bin/env node
// Generates a QA hub from the interview answers.
//   node generate-hub.mjs --answers answers.json --out ../my-qa-hub          create (refuses to overwrite files you changed)
//   node generate-hub.mjs --answers answers.json --out ../my-qa-hub --update re-copy framework files (tools, lib, schemas,
//                                                                             board template, configs); keeps bugs, specs, runs
//   node generate-hub.mjs --answers answers.json --out hub --check           exit 1 if the hub differs from what would be generated
// The answers format is described in ../interview.md and examples/acme-leave/answers.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(here, '..', '..', '..', 'templates', 'hub');
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const answersFile = opt('--answers');
const outArg = opt('--out');
if (!answersFile || !outArg) {
  console.error('usage: generate-hub.mjs --answers answers.json --out DIR [--update | --check]');
  process.exit(2);
}
const mode = args.includes('--check') ? 'check' : args.includes('--update') ? 'update' : 'create';
const A = JSON.parse(readFileSync(answersFile, 'utf8'));

const LABELS = {
  'spec-assurance': 'spec assurance', 'exploratory-hunt': 'exploratory hunts', 'smoke-check': 'smoke checks', 'regression-run': 'regression runs',
  'bug-report': 'bug file', 'bug-video': 'captioned video', 'regression-spec': 'regression spec with knownBug', 'smoke-spec': 'smoke suite',
  board: 'board with fix prompts', 'prd-checklist': 'requirements coverage table',
};
const list = (xs) => (xs?.length ? xs.map((x) => LABELS[x] || x).join(', ') : 'none chosen yet');

function registryDoc() {
  const apps = {};
  for (const a of A.apps) {
    apps[a.name] = {
      prefix: a.prefix,
      owner: a.owner,
      repo: a.repo,
      ...(a.version ? { version: a.version } : {}),
      requirements: a.requirements || [],
      environments: a.environments,
      login: a.login,
      testAccounts: a.testAccounts,
      ...(a.areas ? { areas: a.areas } : {}),
      routines: a.routines || {},
    };
  }
  return {
    hub: {
      name: A.hubName,
      timezone: A.timezone || 'UTC',
      defaultEnv: A.defaultEnv || 'local',
      testTypes: A.testTypes,
      deliverables: A.deliverables,
      production: A.production || { policy: 'smoke-only', exceptions: [] },
      board: A.board || { publish: 'local' },
    },
    apps,
  };
}

function appsTable() {
  const rows = A.apps.map((a) => `| ${a.name} | ${a.prefix} | ${a.owner?.name || '–'}${a.owner?.contact ? ` (${a.owner.contact})` : ''} | ${a.repo.url || a.repo.path} | ${a.repo.branch || '–'} | ${Object.keys(a.environments).join(', ')} |`);
  return ['| App | Bug prefix | Owner | Repo | Branch | Environments |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

function environmentsTable() {
  const rows = [];
  for (const a of A.apps) {
    for (const [env, e] of Object.entries(a.environments)) {
      const db = e.db;
      const where = !db ? '–' : db.engine === 'sqlite' ? `sqlite \`${db.file}\`` : `${db.engine} ${db.host}:${db.port}/${db.name}`;
      const reach = db?.tunnel ? `SSH tunnel via ${db.tunnel.via}` : db?.vpn ? `VPN: ${db.vpn}` : 'direct';
      const access = env === 'prod' ? db?.access === 'read-only' ? 'read-only role' : 'none' : env === 'local' ? 'read-write (throw-away)' : db?.access || 'none';
      rows.push(`| ${a.name} | ${env} | ${e.url} | ${where} | ${access} | ${db ? reach : '–'} | ${env === 'local' ? 'n/a' : db?.restoresNightly ? 'yes' : 'no: snapshot before unattended writes'} |`);
    }
  }
  return ['| App | Env | URL | Database | DB access | Reached by | Restores nightly |', '|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function productionPolicy() {
  const p = A.production?.policy || 'smoke-only';
  return p === 'none'
    ? 'not tested at all.'
    : 'read-only smoke on synthetic accounts only. The AI never writes to production. DB reads only with a read-only role.';
}

function productionExceptions() {
  const xs = A.production?.exceptions || [];
  if (!xs.length) return 'None. Any exception must be added here and in `registry.yaml` with who approved it, the scope and an end date.';
  return xs.map((x) => `- ${x.app}: ${x.scope}. Approved by ${x.approvedBy}, ends ${x.ends}.`).join('\n');
}

function routinesText() {
  const out = [];
  for (const a of A.apps) {
    for (const [k, r] of Object.entries(a.routines || {})) if (r.enabled) out.push(`${a.name} ${k} at ${r.at || '?'} on ${r.env || 'dev'}${r.hardStop ? `, hard stop ${r.hardStop}` : ''}`);
  }
  return out.length ? out.join('; ') : 'none yet (use the routine-setup skill)';
}

function boardText() {
  const p = A.board?.publish || 'local';
  return { local: 'built locally, open board/index.html', artifact: 'published as a private Claude Artifact (board skill)', pages: 'published to GitHub Pages from board/dist (board skill)' }[p] || p;
}

function boardHowTo() {
  const p = A.board?.publish || 'local';
  if (p === 'pages') return 'Run `npm run board:dist` and publish `board/dist/` with GitHub Pages (Settings → Pages), or ask Claude to use the board skill.';
  if (p === 'artifact') return 'Ask Claude: "publish the board" (board skill). It builds `board/dist/` and publishes it as a private Claude Artifact you can share.';
  return 'Open `board/index.html` in a browser. To share it, run `npm run board:dist` and publish `board/dist/` (GitHub Pages or a Claude Artifact).';
}

const vars = {
  hubName: A.hubName,
  hubSlug: A.hubSlug,
  generatedOn: A.generatedOn || new Date().toISOString().slice(0, 10),
  appList: A.apps.map((a) => a.name).join(', '),
  appsTable: appsTable(),
  requirementsSources: A.apps.flatMap((a) => (a.requirements || []).map((r) => `${a.name}: ${r.location}`)).join('; ') || 'see registry.yaml',
  environmentsTable: environmentsTable(),
  productionPolicy: productionPolicy(),
  productionExceptions: productionExceptions(),
  testTypes: list(A.testTypes),
  deliverables: list(A.deliverables),
  routines: routinesText(),
  timezone: A.timezone || 'UTC',
  boardPublish: boardText(),
  boardPublishHowTo: boardHowTo(),
};
const render = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

// Framework-owned files: always the template's version. Hub-owned files: created once, then left alone.
function templateFiles(dir = TEMPLATE) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...templateFiles(p));
    else out.push(relative(TEMPLATE, p));
  }
  return out;
}

const files = new Map();
for (const f of templateFiles()) {
  const text = readFileSync(join(TEMPLATE, f), 'utf8');
  if (f === 'gitignore.tmpl') files.set('.gitignore', text);
  else if (f.endsWith('.tmpl')) files.set(f.slice(0, -5), render(text));
  else if (f === 'package.json') files.set(f, render(text));
  else files.set(f, text);
}
files.set('registry.yaml', `# Registry: one entry per app this hub tests. Secrets are references ({ env } / { keychain }), never values.\n# Generated by ownership-setup; edit freely, then run npm run validate.\n${stringify(registryDoc(), { lineWidth: 120 })}`);
const localDb = A.apps.map((a) => a.environments.local?.db).find((d) => d);
files.set('qa.env', `# Non-secret settings (see qa.env.example)\nQA_ENV=${A.defaultEnv || 'local'}\n${localDb ? `QA_ISOLATED_DB=${localDb.engine === 'sqlite' ? localDb.file : localDb.name}\n` : ''}`);
for (const a of A.apps) {
  for (const d of ['bugs', 'videos/demos', 'specs/regression', 'specs/smoke', 'explore', 'db-actions']) files.set(`qa/${a.name}/${d}/.gitkeep`, '');
  files.set(`runs/${a.name}/.gitkeep`, '');
  files.set(`qa/${a.name}/specs/smoke/login.spec.mjs`, smokeStarter(a));
}
files.set('board/data/.gitkeep', '');

function smokeStarter(a) {
  const roles = Object.keys(a.testAccounts?.roles || {});
  return `// Smoke: every role can log in and sees the app. Read-only, safe on any environment.
// Generated by ownership-setup; the smoke-spec skill adds one core flow per role.
import { test, expect, loginPage } from '../../../../lib/qa.mjs';

test.describe('${a.name} smoke', () => {
${roles.map((r) => `  test('${r} can log in', async ({ page, appName }) => {
    await loginPage(page, appName, '${r}');
    await expect(page.locator(${JSON.stringify(a.login.ui.loggedIn)})).toContainText(/\\S/);
  });`).join('\n\n')}
});
`;
}

// Hub-owned: generated once, never overwritten by --update (bugs, specs, runs, notes are never touched at all).
const HUB_OWNED = new Set(['CLAUDE.md', 'README.md', 'registry.yaml', 'qa.env', '.gitignore']);
const isHubOwned = (f) => HUB_OWNED.has(f) || f.startsWith('playbook/') || f.startsWith('qa/') || f.startsWith('runs/') || f.startsWith('accounts/') || f.startsWith('board/data/');

function write(root) {
  const skipped = [];
  for (const [f, text] of files) {
    const p = join(root, f);
    if (existsSync(p)) {
      const same = readFileSync(p, 'utf8') === text;
      if (same) continue;
      if (mode === 'create' || isHubOwned(f)) {
        skipped.push(f);
        continue;
      }
    }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  return skipped;
}

const out = resolve(outArg);
if (mode === 'check') {
  const diffs = [];
  for (const [f, text] of files) {
    const p = join(out, f);
    if (!existsSync(p)) diffs.push(`missing ${f}`);
    else if (readFileSync(p, 'utf8') !== text && !(f.startsWith('qa/') && f.endsWith('login.spec.mjs'))) diffs.push(`differs ${f}`);
  }
  if (diffs.length) {
    console.error(`generate-hub --check: ${outArg} is not what the generator makes from ${answersFile}:\n  ${diffs.join('\n  ')}`);
    console.error(`Fix: node ${relative(process.cwd(), fileURLToPath(import.meta.url))} --answers ${answersFile} --out ${outArg} --update`);
    process.exit(1);
  }
  console.log(`generate-hub --check: ${outArg} matches the templates (${files.size} files)`);
} else {
  const skipped = write(out);
  console.log(`hub ${mode === 'update' ? 'updated' : 'generated'} at ${out} (${files.size} files)`);
  if (skipped.length) console.log(`kept your version of: ${skipped.join(', ')}`);
  console.log('next: cd into it, then npm install && npm run init && npm run sync && npm run smoke');
}
