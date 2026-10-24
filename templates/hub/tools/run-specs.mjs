#!/usr/bin/env node
// Runs a suite and sorts the results.
//   npm run regression [-- --app acme-leave]     every regression spec
//   npm run e2e        [-- --app acme-leave]     the full end-to-end suite (every requirement, the refactoring safety net)
//   npm run smoke      [-- --app acme-leave]     the read-only smoke suite
// Each failure is sorted into: new regression · known bug still open · bug possibly fixed (a knownBug test that passed).
// Results go to runs/<app>/<run-id>/specs-<suite>.json and status.json. The run id comes from QA_RUN_ID, or a new
// "attended" run is started.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB, rel, appNames, targetEnv, runsDir, newRunId, readJson, writeJson, fail, qaDir, prodException } from './lib/hub.mjs';

const args = process.argv.slice(2);
const suite = args[0];
if (!['regression', 'e2e', 'smoke'].includes(suite)) fail('usage: run-specs.mjs regression|e2e|smoke [--app NAME]');
const only = args.includes('--app') ? args[args.indexOf('--app') + 1] : null;
const env = targetEnv();
const runId = process.env.QA_RUN_ID || newRunId(process.env.QA_MODE || 'attended');
const config = suite === 'smoke' ? 'playwright.smoke.config.mjs' : 'playwright.config.mjs';

if (env === 'prod' && suite !== 'smoke') {
  const names = only ? [only] : appNames();
  const blocked = names.filter((n) => !prodException(n));
  if (blocked.length) fail(`production is read-only smoke only (no written, time-boxed exception for ${blocked.join(', ')} in registry.yaml)`);
}

function collect(suiteNode, path = []) {
  const out = [];
  for (const s of suiteNode.suites || []) out.push(...collect(s, [...path, s.title]));
  for (const spec of suiteNode.specs || []) {
    for (const t of spec.tests) {
      const last = t.results.at(-1) || {};
      const known = t.annotations.find((a) => a.type === 'knownBug');
      out.push({
        project: t.projectName,
        file: spec.file,
        line: spec.line,
        title: [...path.slice(1), spec.title].filter(Boolean).join(' › '),
        outcome: t.status, // expected | unexpected | flaky | skipped
        status: last.status,
        expectedStatus: t.expectedStatus,
        knownBug: known ? known.description.split(':')[0] : null,
        error: last.error ? String(last.error.message || '').split('\n').slice(0, 6).join('\n') : null,
        duration: last.duration,
      });
    }
  }
  return out;
}

function classify(t) {
  if (t.outcome === 'skipped') return 'skipped';
  if (t.knownBug) {
    if (t.status === 'passed') return 'possibly-fixed';
    return t.outcome === 'expected' ? 'known-bug-open' : 'error';
  }
  if (t.outcome === 'flaky') return 'flaky';
  return t.outcome === 'expected' ? 'passed' : 'new-regression';
}

const names = only ? [only] : appNames();
const projects = names.map((n) => `${n}-${suite}`);
const jsonOut = join(HUB, 'test-results', `${runId}-${suite}.json`);
const res = spawnSync('npx', ['playwright', 'test', '-c', config, ...projects.flatMap((p) => ['--project', p]), '--reporter=list,json'], {
  cwd: HUB,
  stdio: 'inherit',
  env: { ...process.env, QA_RUN_ID: runId, QA_ENV: env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut },
});
if (!existsSync(jsonOut)) fail(`playwright produced no results (exit ${res.status})`);
const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
const all = (report.suites || []).flatMap((s) => collect(s, [s.title]));

let worst = 0;
for (const name of names) {
  const tests = all.filter((t) => t.project === `${name}-${suite}`).map((t) => ({ ...t, result: classify(t) }));
  const dir = join(runsDir(name), runId);
  const summary = tests.reduce((acc, t) => ({ ...acc, [t.result]: (acc[t.result] || 0) + 1 }), { total: tests.length });
  writeJson(join(dir, `specs-${suite}.json`), { suite, runId, environment: env, finished: new Date().toISOString(), summary, tests });
  const statusFile = join(dir, 'status.json');
  const sv = existsSync(join(qaDir(name), 'source-version.json')) ? readJson(join(qaDir(name), 'source-version.json')) : {};
  const status = existsSync(statusFile) ? readJson(statusFile) : {
    app: name, runId, mode: process.env.QA_MODE || 'attended', environment: env, started: new Date().toISOString(), finished: null,
    status: 'inconclusive', versions: { old: sv.lastTested || null, new: sv.checkedOut || null }, newFindings: [], possiblyFixed: [],
    specs: {}, notExplored: [], notes: [],
  };
  status.specs[suite] = summary;
  status.possiblyFixed = [...new Set([...(status.possiblyFixed || []), ...tests.filter((t) => t.result === 'possibly-fixed').map((t) => t.knownBug)])];
  status.regressions = [...new Set([...(status.regressions || []), ...tests.filter((t) => ['new-regression', 'error'].includes(t.result)).map((t) => `${t.file} › ${t.title}`)])];
  if (process.env.QA_MODE === undefined || process.env.QA_MODE === 'attended') {
    status.finished = new Date().toISOString();
    status.status = tests.length ? 'complete' : 'inconclusive';
  }
  writeJson(statusFile, status);

  const line = (k) => (summary[k] ? `${summary[k]} ${k}` : null);
  console.log(`\n${name} ${suite} (${env}, run ${runId}): ${[line('passed'), line('known-bug-open'), line('possibly-fixed'), line('new-regression'), line('error'), line('flaky'), line('skipped')].filter(Boolean).join(' · ') || 'no tests'}`);
  for (const t of tests.filter((x) => x.result === 'new-regression' || x.result === 'error')) console.log(`  ✖ ${t.result}: ${t.file} › ${t.title}`);
  for (const t of tests.filter((x) => x.result === 'possibly-fixed')) console.log(`  ✓ possibly fixed: ${t.knownBug} (${t.file} › ${t.title}). Confirm, then set the bug to "fixed" and remove the knownBug marker in a pull request.`);
  console.log(`  results: ${rel(join(dir, `specs-${suite}.json`))}`);
  if (summary['new-regression'] || summary.error) worst = 1;
}
// Red stops the line: a new regression fails the command, so a routine stops and reports it.
process.exit(worst);
