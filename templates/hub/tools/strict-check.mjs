#!/usr/bin/env node
// Proves every regression spec works, by running it twice:
//   normal mode           every test must pass (knownBug tests are expected to fail, so they count as passing)
//   REGRESSION_STRICT=1   every knownBug test must FAIL, on its real assertion (an expect(...) error),
//                         not on a helper error; every other test must still pass
// A knownBug test that passes in strict mode does not test the bug. One that fails with a helper error tests the setup.
//   npm run strict-check [-- --app acme-leave]   (regression and e2e suites)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HUB, appNames, fail } from './lib/hub.mjs';

const args = process.argv.slice(2);
const only = args.includes('--app') ? args[args.indexOf('--app') + 1] : null;
// Both suites that may carry knownBug markers: regression and the full e2e suite.
const projects = (only ? [only] : appNames()).flatMap((n) => ['--project', `${n}-regression`, '--project', `${n}-e2e`]);

function run(strict) {
  const out = join(HUB, 'test-results', `strict-check-${strict ? 'strict' : 'normal'}.json`);
  spawnSync('npx', ['playwright', 'test', '-c', 'playwright.config.mjs', ...projects, '--reporter=json', '--retries=0'], {
    cwd: HUB,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, QA_RUN_ID: process.env.QA_RUN_ID || 'strict-check', REGRESSION_STRICT: strict ? '1' : '', PLAYWRIGHT_JSON_OUTPUT_NAME: out },
  });
  if (!existsSync(out)) fail('playwright produced no results');
  const flat = [];
  const walk = (s, path) => {
    for (const c of s.suites || []) walk(c, [...path, c.title]);
    for (const spec of s.specs || []) for (const t of spec.tests) {
      const r = t.results.at(-1) || {};
      flat.push({
        id: `${spec.file} › ${[...path.slice(1), spec.title].join(' › ')}`,
        knownBug: t.annotations.find((a) => a.type === 'knownBug')?.description.split(':')[0] || null,
        outcome: t.status, status: r.status, error: r.error?.message || '',
      });
    }
  };
  for (const s of JSON.parse(readFileSync(out, 'utf8')).suites || []) walk(s, [s.title]);
  return flat;
}

const problems = [];
const normal = run(false);
for (const t of normal) {
  if (t.outcome === 'expected' || t.outcome === 'skipped') continue;
  problems.push(t.knownBug && t.status === 'passed'
    ? `normal mode: ${t.id} passed although it is marked knownBug('${t.knownBug}'): either the bug is fixed (remove the marker) or the test does not reproduce it`
    : `normal mode: ${t.id} failed (${t.status})`);
}

const strict = run(true);
for (const t of strict) {
  if (!t.knownBug) {
    if (t.status !== 'passed' && t.status !== 'skipped') problems.push(`strict mode: ${t.id} failed but has no knownBug marker`);
    continue;
  }
  if (t.status === 'passed') problems.push(`strict mode: ${t.id} passed, so it does not reproduce ${t.knownBug} (or the bug is fixed)`);
  else if (/\[helper\]/.test(t.error) || !/expect\(/.test(t.error)) problems.push(`strict mode: ${t.id} failed on a setup or helper error, not on its assertion:\n      ${t.error.split('\n')[0]}`);
}

const known = strict.filter((t) => t.knownBug);
console.log(`strict-check: ${normal.length} tests; normal mode ${normal.filter((t) => t.outcome === 'expected').length} green; strict mode ${known.length} knownBug test(s) checked (${[...new Set(known.map((t) => t.knownBug))].join(', ') || 'none'})`);
if (problems.length) {
  console.error('\n✖ ' + problems.join('\n✖ '));
  process.exit(1);
}
console.log('✓ every knownBug test fails on its real assertion in strict mode, and the suite is green in normal mode');
