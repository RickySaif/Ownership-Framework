#!/usr/bin/env node
// Coverage gate, counted by requirement (acceptance criterion), not by lines of code.
//   npm run coverage                         every suite, report only
//   npm run coverage -- --suite e2e --min 100   fail unless every testable requirement has an e2e test
// Requirements come from qa/<app>/requirements.json (spec-assurance). Rules marked "not-testable" are left out of
// the count and listed with their reason. A requirement counts as covered when a test title names its id (R4 …).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appNames, qaDir, readJson, fail } from './lib/hub.mjs';
import { specIndex, SUITES } from './lib/specs.mjs';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const only = opt('--app');
const suites = opt('--suite') ? opt('--suite').split(',') : SUITES;
const min = opt('--min') !== undefined ? Number(opt('--min')) : null;
let failed = false;

for (const name of only ? [only] : appNames()) {
  const file = join(qaDir(name), 'requirements.json');
  if (!existsSync(file)) {
    console.log(`${name}: no qa/${name}/requirements.json yet (run the spec-assurance skill first)`);
    if (min !== null) failed = true;
    continue;
  }
  const rules = readJson(file).rules || [];
  const testable = rules.filter((r) => r.verdict !== 'not-testable');
  const specs = specIndex(name, suites);
  const rows = testable.map((r) => ({ ...r, tests: specs.filter((s) => s.requirements.includes(r.id)) }));
  const covered = rows.filter((r) => r.tests.length);
  const pct = testable.length ? Math.round((covered.length / testable.length) * 1000) / 10 : 100;
  console.log(`\n${name} · suites: ${suites.join(', ')} · ${covered.length} of ${testable.length} testable requirements covered (${pct}%)`);
  for (const r of rows) console.log(`  ${r.tests.length ? '✓' : '✖'} ${r.id.padEnd(4)} ${r.text}${r.tests.length ? `  (${r.tests.length} test${r.tests.length > 1 ? 's' : ''})` : '  ← no test'}`);
  for (const r of rules.filter((x) => x.verdict === 'not-testable')) console.log(`  ○ ${r.id.padEnd(4)} not testable: ${r.reason || 'no reason given'}`);
  if (min !== null && pct < min) {
    console.log(`  below the ${min}% gate`);
    failed = true;
  }
}
if (failed) fail('coverage gate not met');
