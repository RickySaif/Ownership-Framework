#!/usr/bin/env node
// Installs and checks everything the hub needs. Safe to run again: each step looks first and only acts when needed.
//   npm run init               check, and ask before installing anything
//   npm run init -- --yes      install what is missing without asking
//   npm run init -- --check    only check, change nothing (used by routines as a preflight)
import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HUB, appNames, app, has, sh } from './lib/hub.mjs';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const checkOnly = args.includes('--check');
const VERSIONS = { playwright: '1.64.1', playwrightMcp: '0.0.83', graphify: '0.9.94' };
const results = [];
const isMac = process.platform === 'darwin';

async function ask(question) {
  if (yes) return true;
  if (checkOnly || !process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`   ${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return a === 'y' || a === 'yes';
}

function run(cmd, cmdArgs) {
  console.log(`   $ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: HUB });
  return r.status === 0;
}

async function step(title, what, { check, install, how, optional = false }) {
  console.log(`\n▸ ${title}\n   ${what}`);
  let ok;
  try {
    ok = await check();
  } catch {
    ok = false;
  }
  if (ok) {
    console.log(`   ✓ ${typeof ok === 'string' ? ok : 'already in place'}`);
    return results.push([title, 'ok']);
  }
  if (install && (await ask('Install it now?'))) {
    if (await install()) {
      const again = await check().catch(() => false);
      if (again) {
        console.log('   ✓ installed');
        return results.push([title, 'installed']);
      }
    }
    console.log('   ✖ install did not finish');
  }
  console.log(`   ${optional ? '○ optional, not installed' : '✖ missing'}${how ? `. To install it yourself: ${how}` : ''}`);
  results.push([title, optional ? 'skipped' : 'missing']);
}

const engines = new Set();
let needsDocker = false;
for (const name of appNames()) {
  for (const e of Object.values(app(name).environments || {})) {
    if (e.db?.engine) engines.add(e.db.engine);
    if (e.setup?.compose) needsDocker = true;
  }
}

await step('Node.js 20 or newer', 'Runs the hub tools and Playwright.', {
  check: () => (Number(process.versions.node.split('.')[0]) >= 20 ? `Node ${process.versions.node}` : false),
  how: 'https://nodejs.org (LTS)',
});

await step(`Playwright ${VERSIONS.playwright} (test runner)`, 'Runs the regression and smoke specs and records the videos. Pinned to an exact version.', {
  check: () => {
    const pkg = join(HUB, 'node_modules', '@playwright', 'test', 'package.json');
    const v = existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).version;
    if (v) return v === VERSIONS.playwright ? `@playwright/test ${v}` : false;
    // An example hub inside the framework repo uses the framework's install.
    try {
      const out = sh('npx', ['--no-install', 'playwright', '--version'], { cwd: HUB });
      return out.includes(VERSIONS.playwright) ? out : false;
    } catch {
      return false;
    }
  },
  install: () => run('npm', ['install', '--save-exact', `@playwright/test@${VERSIONS.playwright}`]),
  how: `npm install --save-exact @playwright/test@${VERSIONS.playwright}`,
});

await step('Playwright browser (Chromium)', 'The browser the specs and videos use. Downloaded once per machine.', {
  check: () => {
    const r = spawnSync('npx', ['--no-install', 'playwright', 'install', '--dry-run', 'chromium'], { cwd: HUB, encoding: 'utf8' });
    const dirs = [...(r.stdout || '').matchAll(/Install location:\s+(.+)/g)].map((m) => m[1].trim());
    return dirs.length && dirs.every((d) => existsSync(d)) ? 'Chromium is installed' : false;
  },
  install: () => run('npx', ['playwright', 'install', 'chromium']),
  how: 'npx playwright install chromium',
});

await step(`Playwright MCP ${VERSIONS.playwrightMcp}`, 'Lets Claude open the app in a browser and look around during exploratory sessions.', {
  check: () => {
    if (!has('claude')) return false;
    const out = sh('claude', ['mcp', 'list']);
    return /playwright/i.test(out) ? 'registered with Claude Code' : false;
  },
  install: () => has('claude') && run('claude', ['mcp', 'add', 'playwright', '--scope', 'project', '--', 'npx', `@playwright/mcp@${VERSIONS.playwrightMcp}`]),
  how: `claude mcp add playwright --scope project -- npx @playwright/mcp@${VERSIONS.playwrightMcp}`,
});

await step(`Graphify ${VERSIONS.graphify}`, 'Builds a knowledge graph of each app\'s source (graphify-out/), so Claude queries the graph before reading code.', {
  check: () => (has('graphify') ? sh('graphify', ['--version']).split('\n')[0] || 'installed' : false),
  install: () => {
    if (has('uv')) return run('uv', ['tool', 'install', `graphifyy==${VERSIONS.graphify}`]);
    if (has('pipx')) return run('pipx', ['install', `graphifyy==${VERSIONS.graphify}`]);
    console.log('   needs uv (https://docs.astral.sh/uv) or pipx (https://pipx.pypa.io)');
    return false;
  },
  how: `uv tool install graphifyy==${VERSIONS.graphify}   (or: pipx install graphifyy==${VERSIONS.graphify})`,
  optional: true,
});

await step('ffmpeg', 'Converts and trims the bug videos (for example to a GIF for a ticket). Playwright records without it.', {
  check: () => (has('ffmpeg') ? sh('ffmpeg', ['-version']).split('\n')[0] : false),
  install: () => (isMac && has('brew') ? run('brew', ['install', 'ffmpeg']) : false),
  how: isMac ? 'brew install ffmpeg' : 'sudo apt-get install ffmpeg   (or your system\'s package manager)',
  optional: true,
});

if (engines.has('postgres')) {
  await step('PostgreSQL client (psql)', 'Reads stored state to confirm bugs, and runs the guarded test-data writes.', {
    check: () => (has('psql') ? sh('psql', ['--version']) : false),
    install: () => (isMac && has('brew') ? run('brew', ['install', 'libpq']) && run('brew', ['link', '--force', 'libpq']) : false),
    how: isMac ? 'brew install libpq && brew link --force libpq' : 'sudo apt-get install postgresql-client',
  });
}
if (engines.has('mysql') || engines.has('mariadb')) {
  await step('MySQL / MariaDB client (mysql)', 'Reads stored state to confirm bugs, and runs the guarded test-data writes.', {
    check: () => (has('mysql') ? sh('mysql', ['--version']) : false),
    install: () => (isMac && has('brew') ? run('brew', ['install', 'mysql-client']) && run('brew', ['link', '--force', 'mysql-client']) : false),
    how: isMac ? 'brew install mysql-client && brew link --force mysql-client' : 'sudo apt-get install mysql-client',
  });
}
if (engines.has('sqlite')) {
  await step('SQLite (built into Node)', 'Reads and writes local SQLite databases.', {
    check: async () => ((await import('node:sqlite')) ? 'node:sqlite available' : false),
    how: 'use Node 22.13 or newer',
  });
}
if (needsDocker) {
  await step('Docker', 'Brings local copies of the apps up with Docker Compose (npm run local:up).', {
    check: () => (has('docker') ? sh('docker', ['--version']) : false),
    how: 'https://docs.docker.com/get-docker/',
  });
}

await step('Hub settings', 'registry.yaml exists and names at least one app.', {
  check: () => (appNames().length ? `${appNames().length} app(s): ${appNames().join(', ')}` : false),
  how: 'run the ownership-setup skill, or edit registry.yaml',
});

await step('Secret check', 'No passwords or tokens in registry.yaml (they belong in the keychain or env).', {
  check: () => {
    const text = readFileSync(join(HUB, 'registry.yaml'), 'utf8');
    return /(password|token|secret)\s*:\s*['"]?[^{[\s'"][^\s'"]{5,}/i.test(text.replace(/publicDemoValue:.*$/gm, '')) ? false : 'clean';
  },
  how: 'replace the value with { keychain: <service> } or { env: <NAME> }',
});

console.log('\nSummary');
for (const [t, s] of results) console.log(`  ${s === 'ok' || s === 'installed' ? '✓' : s === 'skipped' ? '○' : '✖'} ${t}: ${s}`);
const missing = results.filter(([, s]) => s === 'missing');
if (missing.length) {
  console.log(`\n${missing.length} required item(s) missing. Fix them and run npm run init again.`);
  process.exit(1);
}
console.log('\nReady. Next: npm run sync');
