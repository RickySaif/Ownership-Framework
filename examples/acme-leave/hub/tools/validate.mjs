#!/usr/bin/env node
// Checks the hub's records against the schemas and against each other.
//   npm run validate
// · every qa/<app>/bugs/<ID>.json matches schemas/bug.schema.json, and its id matches the file name
// · the video and spec it points to exist
// · an open bug's spec carries knownBug('<ID>'); a fixed bug's spec no longer does
// · every runs/<app>/<run-id>/status.json matches schemas/status.schema.json
// · registry.yaml has the fields the tools need, and no secret values
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { HUB, rel, appNames, app, qaDir, runsDir, listDir, isDir, readJson } from './lib/hub.mjs';

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
const bugSchema = ajv.compile(readJson(join(HUB, 'schemas', 'bug.schema.json')));
const statusSchema = ajv.compile(readJson(join(HUB, 'schemas', 'status.schema.json')));
const problems = [];
const say = (file, msg) => problems.push(`${rel(file)}: ${msg}`);
const errs = (v) => v.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ');

// A key named like a secret with a literal value. References ({ env }, { keychain }) and CSS selectors ([…]) are fine.
const SECRETISH = /(password|secret|token|apikey|api_key)\s*:\s*['"]?(?![[{])[^\s'"{}][^\s'"]{5,}/i;
const regFile = join(HUB, 'registry.yaml');
readFileSync(regFile, 'utf8').split('\n').forEach((line, i) => {
  if (SECRETISH.test(line) && !/publicDemoValue/.test(line)) say(regFile, `line ${i + 1} looks like a secret value; use { env: NAME } or { keychain: service } instead`);
});

let bugs = 0;
let statuses = 0;
for (const name of appNames()) {
  const a = app(name);
  for (const field of ['owner', 'repo', 'environments']) if (!a[field]) say(regFile, `${name}: missing ${field}`);
  for (const [env, e] of Object.entries(a.environments || {})) {
    if (!['local', 'dev', 'staging', 'prod'].includes(env)) say(regFile, `${name}: unknown environment ${env}`);
    if (env === 'prod' && e.db?.access && e.db.access !== 'read-only' && e.db.access !== 'none') say(regFile, `${name}: production db access must be read-only or none`);
  }
  const bugDir = join(qaDir(name), 'bugs');
  for (const f of listDir(bugDir, (f) => f.endsWith('.json'))) {
    const file = join(bugDir, f);
    let bug;
    try {
      bug = readJson(file);
    } catch (err) {
      say(file, `not valid JSON (${err.message})`);
      continue;
    }
    bugs++;
    if (!bugSchema(bug)) say(file, errs(bugSchema));
    if (bug.id && f !== `${bug.id}.json`) say(file, `file name must be ${bug.id}.json`);
    for (const k of ['video', 'videoAfter', 'spec']) if (bug[k] && !existsSync(join(HUB, bug[k]))) say(file, `${k} ${bug[k]} does not exist`);
    if (bug.spec && existsSync(join(HUB, bug.spec))) {
      const src = readFileSync(join(HUB, bug.spec), 'utf8');
      const marked = new RegExp(`knownBug\\(\\s*['"]${bug.id}['"]`).test(src);
      if (bug.state === 'open' && !marked) say(file, `bug is open but ${bug.spec} has no knownBug('${bug.id}', …)`);
      if (bug.state === 'fixed' && marked) say(file, `bug is fixed but ${bug.spec} still has knownBug('${bug.id}', …)`);
    }
    if (bug.state === 'open' && !bug.spec) say(file, 'open bug without a regression spec (run the regression-spec skill)');
  }
  for (const run of listDir(runsDir(name), (f, p) => isDir(p))) {
    const file = join(runsDir(name), run, 'status.json');
    if (!existsSync(file)) continue;
    statuses++;
    const s = readJson(file);
    if (!statusSchema(s)) say(file, errs(statusSchema));
    if (s.runId && s.runId !== run) say(file, `runId ${s.runId} does not match folder ${run}`);
  }
}

if (problems.length) {
  console.error(`validate: ${problems.length} problem(s)\n  ✖ ${problems.join('\n  ✖ ')}`);
  process.exit(1);
}
console.log(`validate: ${bugs} bug file(s) and ${statuses} run status file(s) are valid`);
