#!/usr/bin/env node
// The scripted parts of a routine. Claude runs these in order and does the exploratory work in between
// (see playbook/routines.md). Each phase writes to runs/<app>/<run-id>/status.json.
//
//   npm run run -- start     --app NAME --mode nightly|weekly|attended [--hard-stop 06:00]
//        → syncs the tip, checks the checkout, checks login, creates the run, prints the run id and what changed
//   npm run run -- specs     --app NAME --run RUN_ID      → regression + smoke, sorted
//   npm run run -- finish    --app NAME --run RUN_ID [--status complete|inconclusive|aborted]
//        → cleanup from the ledger, validate, board rebuild, closes status.json
//   npm run run -- time-left --app NAME --run RUN_ID      → minutes left before the hard stop (exit 1 when past it)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { HUB, registry, app, targetEnv, qaDir, runsDir, newRunId, readJson, writeJson, fail } from './lib/hub.mjs';

const [phase, ...rest] = process.argv.slice(2);
const opt = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : undefined);
const appName = opt('--app');
if (!appName) fail('usage: routine.mjs start|specs|finish|time-left --app NAME …');
app(appName);
const env = targetEnv();

function npm(script, args = [], extraEnv = {}) {
  const r = spawnSync('npm', ['run', '--silent', script, ...(args.length ? ['--', ...args] : [])], {
    cwd: HUB, stdio: 'inherit', env: { ...process.env, QA_ENV: env, ...extraEnv },
  });
  return r.status === 0;
}

const statusPath = (runId) => join(runsDir(appName), runId, 'status.json');
function load(runId) {
  if (!runId || !existsSync(statusPath(runId))) fail(`no run ${runId} for ${appName}`);
  return readJson(statusPath(runId));
}

function hardStopIso(hhmm) {
  if (!hhmm) return null;
  const tz = registry().hub?.timezone || 'UTC';
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const [h, m] = hhmm.split(':').map(Number);
  const stop = new Date(local);
  stop.setHours(h, m, 0, 0);
  if (stop <= local) stop.setDate(stop.getDate() + 1);
  return new Date(now.getTime() + (stop - local)).toISOString();
}

if (phase === 'start') {
  const mode = opt('--mode') || 'attended';
  const runId = newRunId(mode);
  const rules = registry().apps[appName].routines?.[mode] || {};
  const hardStop = hardStopIso(opt('--hard-stop') || rules.hardStop);
  const status = {
    app: appName, runId, mode, environment: env, started: new Date().toISOString(), finished: null, hardStop,
    status: 'inconclusive', versions: { old: null, new: null }, newFindings: [], possiblyFixed: [], regressions: [],
    specs: {}, explored: [], notExplored: [], notes: [],
  };
  writeJson(statusPath(runId), status);
  console.log(`\n▸ preflight for ${appName} on ${env}, run ${runId}`);
  const steps = [
    ['sync', () => npm('sync', ['--app', appName, '--env', env])],
    ['sync:check', () => npm('sync:check', ['--app', appName], { QA_RUN_ID: runId })],
  ];
  for (const [name, fn] of steps) {
    if (!fn()) {
      status.status = 'aborted';
      status.finished = new Date().toISOString();
      status.notes.push(`preflight failed at ${name}`);
      writeJson(statusPath(runId), status);
      fail(`preflight failed at ${name}; run ${runId} marked aborted`);
    }
  }
  const sv = readJson(join(qaDir(appName), 'source-version.json'));
  status.versions = { old: sv.lastTested, new: sv.checkedOut };
  writeJson(statusPath(runId), status);
  console.log(`\nRUN_ID=${runId}`);
  console.log(`versions: ${sv.lastTested || '(first run)'} → ${sv.checkedOut}`);
  console.log(`changed since last tested: ${sv.commitsSinceLastTested} commit(s), ${sv.filesChangedSinceLastTested.length} file(s)`);
  for (const f of sv.filesChangedSinceLastTested.slice(0, 80)) console.log(`  ${f}`);
  if (hardStop) console.log(`hard stop: ${hardStop}`);
  console.log('\nNext: npm run run -- specs --app ' + appName + ' --run ' + runId);
} else if (phase === 'specs') {
  const runId = opt('--run');
  const status = load(runId);
  const extra = { QA_RUN_ID: runId, QA_MODE: status.mode };
  const smokeOk = npm('smoke', ['--app', appName], extra);
  const regressionOk = env === 'prod' ? true : npm('regression', ['--app', appName], extra);
  const after = load(runId);
  if (!smokeOk || !regressionOk) after.notes.push('Red: a new regression or error. Red stops the line: report it before any new work.');
  writeJson(statusPath(runId), after);
  process.exit(smokeOk && regressionOk ? 0 : 1);
} else if (phase === 'finish') {
  const runId = opt('--run');
  const status = load(runId);
  const ok = { cleanup: npm('cleanup', ['--app', appName, '--run', runId], { QA_RUN_ID: runId }), validate: npm('validate'), board: npm('board') };
  for (const [k, v] of Object.entries(ok)) if (!v) status.notes.push(`${k} failed; see the run log`);
  const wanted = opt('--status');
  status.status = wanted || (ok.cleanup && ok.validate && Object.keys(status.specs).length ? 'complete' : 'inconclusive');
  status.finished = new Date().toISOString();
  writeJson(statusPath(runId), status);
  console.log(`run ${runId}: ${status.status}`);
} else if (phase === 'time-left') {
  const status = load(opt('--run'));
  if (!status.hardStop) console.log('no hard stop set');
  else {
    const mins = Math.floor((Date.parse(status.hardStop) - Date.now()) / 60000);
    console.log(`${mins} minute(s) left before the hard stop (${status.hardStop})`);
    if (mins <= 0) process.exit(1);
  }
} else {
  fail(`unknown phase ${phase}`);
}
