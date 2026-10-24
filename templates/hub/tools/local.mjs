#!/usr/bin/env node
// Brings a local, throw-away copy of each app up (or down), from its synced source.
//   npm run local:up   [-- --app NAME]
//   npm run local:down [-- --app NAME]
// The source in apps/local/<app> stays read-only: it is copied to .local-run/<app> and run from there.
// registry.yaml, environments.local.setup:
//   compose: docker-compose.yml          → docker compose up -d (then migrate/seed run inside the copy)
//   steps: [ "npm ci", "npm run build" ] → run in order
//   migrate: "npm run migrate"           seed: "npm run seed"
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HUB, rel, appNames, app, appDir, fail } from './lib/hub.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const only = rest.includes('--app') ? rest[rest.indexOf('--app') + 1] : null;
if (!['up', 'down'].includes(cmd)) fail('usage: local.mjs up|down [--app NAME]');

function sh(line, cwd) {
  console.log(`  $ ${line}`);
  const r = spawnSync(line, { cwd, shell: true, stdio: 'inherit', env: { ...process.env, QA_ENV: 'local' } });
  if (r.status !== 0) fail(`"${line}" failed in ${rel(cwd)}`);
}

for (const name of only ? [only] : appNames()) {
  const e = app(name).environments?.local;
  if (!e?.setup) continue;
  const src = appDir('local', name);
  const work = join(HUB, '.local-run', name);
  console.log(`\n${name}: ${cmd}`);
  if (cmd === 'down') {
    if (e.setup.compose && existsSync(work)) sh(`docker compose -f ${e.setup.compose} down -v`, work);
    if (e.setup.stop) sh(e.setup.stop, work);
    rmSync(work, { recursive: true, force: true });
    continue;
  }
  if (!existsSync(src)) fail(`${name}: not synced. Run npm run sync -- --env local --app ${name}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(HUB, '.local-run'), { recursive: true });
  cpSync(src, work, { recursive: true, filter: (p) => !p.includes(`${name}/.git`) });
  spawnSync('chmod', ['-R', 'u+w', work]);
  if (e.setup.compose) sh(`docker compose -f ${e.setup.compose} up -d --build`, work);
  for (const s of e.setup.steps || []) sh(s, work);
  if (e.setup.migrate) sh(e.setup.migrate, work);
  if (e.setup.seed) sh(e.setup.seed, work);
  console.log(`  ✓ ${name} is up at ${e.url}. Seed data must be synthetic or masked, never a copy of real customer data.`);
}
