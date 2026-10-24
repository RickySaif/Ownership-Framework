#!/usr/bin/env node
// Stops a run when the checked-out source is not the commit the run says it tests.
//   npm run sync:check [-- --app acme-leave] [--expect <sha>]
// The expected commit is, in order: --expect, QA_EXPECT_SHA, the run's status.json versions.new, or the
// checkedOut commit in qa/<app>/source-version.json. Also checks that nobody edited the read-only copy.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HUB, app, appNames, targetEnv, appDir, qaDir, runsDir, readJson, git, sh, fail } from './lib/hub.mjs';

const args = process.argv.slice(2);
const only = args.includes('--app') ? args[args.indexOf('--app') + 1] : null;
const expectArg = args.includes('--expect') ? args[args.indexOf('--expect') + 1] : process.env.QA_EXPECT_SHA;
const env = targetEnv();
const bad = [];

for (const name of only ? [only] : appNames()) {
  const a = app(name);
  if (!a.environments?.[env]) continue;
  const dir = appDir(env, name);
  const svFile = join(qaDir(name), 'source-version.json');
  if (!existsSync(dir) || !existsSync(svFile)) {
    bad.push(`${name}: not synced for ${env}. Run: npm run sync -- --app ${name}`);
    continue;
  }
  const sv = readJson(svFile);
  if (sv.environment !== env) bad.push(`${name}: source-version.json is for ${sv.environment}, this run targets ${env}`);
  const runStatus = process.env.QA_RUN_ID && join(runsDir(name), process.env.QA_RUN_ID, 'status.json');
  const expected = expectArg || (runStatus && existsSync(runStatus) && readJson(runStatus).versions?.new) || sv.checkedOut;
  let actual;
  if (a.repo.provider === 'path') {
    actual = sv.checkedOut;
    try {
      actual = sh('git', ['-C', resolve(HUB, a.repo.path), 'log', '-1', '--format=%H', '--', '.']) || actual;
    } catch { /* not in git: trust the record */ }
  } else {
    actual = git(dir, 'rev-parse', 'HEAD');
    const dirty = git(dir, 'status', '--porcelain');
    if (dirty) bad.push(`${name}: the read-only copy in apps/${env}/${name} was edited:\n    ${dirty.split('\n').slice(0, 5).join('\n    ')}\n  Run npm run sync to restore it.`);
  }
  if (!actual || !expected || (!actual.startsWith(expected.slice(0, 12)) && !expected.startsWith(actual.slice(0, 12)))) {
    bad.push(`${name}: checked out ${actual || 'nothing'} but the run says it tests ${expected || 'nothing'}. Run npm run sync, or start a new run.`);
  } else {
    console.log(`✓ ${name} (${env}) at ${actual.slice(0, 12)}`);
  }
}
if (bad.length) fail(`sync:check stopped the run\n  ${bad.join('\n  ')}`);
