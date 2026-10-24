#!/usr/bin/env node
// The run ledger: everything a run creates or changes, one JSON line each, in runs/<app>/<run-id>/ledger.jsonl.
// Cleanup reads ONLY from the ledger, newest first, so it can never touch data that existed before the run.
//
//   npm run ledger -- show    --app acme-leave --run 20261023-0200-nightly
//   npm run cleanup -- --app acme-leave --run 20261023-0200-nightly [--dry-run]
//
// A "created" entry says how to undo it:
//   { kind: "created", table: "requests", id: 12, cleanup: { via: "api", role: "employee", method: "POST", path: "/api/requests/12/cancel" } }
//   { kind: "created", table: "requests", id: 12, cleanup: { via: "db", sql: "DELETE FROM requests WHERE id = 12" } }
//   { kind: "created", table: "requests", id: 12, cleanup: { via: "reset" } }      (local only: the database is thrown away)
import { join } from 'node:path';
import { request } from '@playwright/test';
import { app, envConfig, targetEnv, runsDir, readJsonl, appendJsonl, fail, secret } from './lib/hub.mjs';
import * as db from './lib/db.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const appName = opt('--app');
const runId = opt('--run') || process.env.QA_RUN_ID;
const dry = args.includes('--dry-run');
if (!appName || !runId) fail('usage: ledger.mjs show|cleanup --app NAME --run RUN_ID [--dry-run]');
const file = join(runsDir(appName), runId, 'ledger.jsonl');
const entries = readJsonl(file);

if (cmd === 'show') {
  for (const e of entries) console.log(`${e.at}  ${e.kind.padEnd(9)} ${e.table || ''} ${e.id ?? (e.ids || []).join(',')}  ${e.why || e.cleanup?.via || ''}`);
  process.exit(0);
}
if (cmd !== 'cleanup') fail(`unknown command ${cmd}`);

const env = targetEnv();
const done = new Set(entries.filter((e) => e.kind === 'cleaned').map((e) => `${e.table}:${e.id}`));
const todo = entries.filter((e) => e.kind === 'created' && !done.has(`${e.table}:${e.id}`)).reverse();
console.log(`cleanup ${appName} run ${runId} on ${env}: ${todo.length} item(s)${dry ? ' (dry run)' : ''}`);

const sessions = {};
async function apiAs(role) {
  if (sessions[role]) return sessions[role];
  const a = app(appName);
  const r = a.testAccounts.roles[role];
  const ctx = await request.newContext({ baseURL: envConfig(appName, env).url });
  const body = JSON.parse(JSON.stringify(a.login.api.body).replace('{user}', r.user).replace('{password}', secret(r.password, `${role} password`)));
  const res = await ctx.fetch(a.login.api.path, { method: a.login.api.method || 'POST', data: body });
  if (!res.ok()) throw new Error(`login as ${role} failed: HTTP ${res.status()}`);
  return (sessions[role] = ctx);
}

let failed = 0;
for (const e of todo) {
  const c = e.cleanup || {};
  const label = `${e.table} ${e.id} via ${c.via || '?'}`;
  try {
    if (dry) {
      console.log(`  would clean ${label}`);
      continue;
    }
    if (c.via === 'reset') {
      if (env !== 'local') throw new Error('"reset" cleanup is only possible on a local, throw-away database');
    } else if (c.via === 'api') {
      const ctx = await apiAs(c.role);
      const res = await ctx.fetch(c.path, { method: c.method || 'DELETE' });
      if (!res.ok() && res.status() !== 404 && res.status() !== 409) throw new Error(`HTTP ${res.status()}`);
    } else if (c.via === 'db') {
      await db.write(appName, { sql: c.sql, table: e.table, ids: [e.id], why: `cleanup of ${runId}` }, env);
    } else {
      throw new Error('no cleanup instruction recorded');
    }
    appendJsonl(file, { at: new Date().toISOString(), kind: 'cleaned', table: e.table, id: e.id, via: c.via });
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failed++;
    console.log(`  ✖ ${label}: ${err.message}`);
  }
}
for (const ctx of Object.values(sessions)) await ctx.dispose();
if (failed) fail(`${failed} item(s) could not be cleaned; they are still listed in the ledger`);
