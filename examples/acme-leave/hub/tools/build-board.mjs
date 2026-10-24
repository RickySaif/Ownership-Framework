#!/usr/bin/env node
// Builds the results board from the hub's records.
//   npm run board                 → board/data/*.json and board/index.html (one self-contained page; open it in a browser)
//   npm run board -- --dist       → also board/dist/ with the videos copied in, ready for GitHub Pages or a Claude Artifact
// Each bug gets a full fix prompt for a coding agent: which file and function, why it is wrong, the fix, and which
// spec must turn green.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { HUB, rel, registry, appNames, app, qaDir, runs, listDir, readJson, writeJson } from './lib/hub.mjs';

const dist = process.argv.includes('--dist');
const reg = registry();

function fixPrompt(bug, a, coverage) {
  const where = bug.where?.file ? `${bug.where.file}${bug.where.function ? `, function \`${bug.where.function}\`` : ''}${bug.where.line ? ` (around line ${bug.where.line})` : ''}` : 'not pinned down yet: start from the area and the steps below';
  const specTests = coverage.filter((c) => c.bug === bug.id).map((c) => `"${c.title}"`);
  return [
    `Fix bug ${bug.id} in ${a.name} (${a.repo.url || a.repo.path}, branch ${a.repo.branch || 'main'}).`,
    '',
    `## The bug: ${bug.title}`,
    bug.summary,
    '',
    `Where: ${where}`,
    '',
    '## Why it is wrong',
    `Requirement ${bug.expected.requirement}${bug.prd ? ` (${bug.prd})` : ''}${bug.expected.link ? `, ${bug.expected.link}` : ''}: ${bug.expected.text}`,
    `Actual: ${bug.actual}`,
    '',
    '## How it was confirmed',
    `- Response: ${bug.how.response}`,
    `- Stored state: ${bug.how.state}`,
    ...(bug.how.byDesignCheck ? [`- Not by design: ${bug.how.byDesignCheck}`] : []),
    '',
    '## Steps to reproduce',
    ...bug.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    '## The fix',
    bug.hint || 'Make the behaviour match the requirement above. Keep the change small and in the place named under "Where".',
    '',
    '## Done when',
    bug.spec
      ? `- The regression spec \`${bug.spec}\`${specTests.length ? ` (test ${specTests.join(', ')})` : ''} passes with REGRESSION_STRICT=1. It is in the QA hub; copy it or ask the QA owner to run it against your branch.`
      : '- A test that states the requirement passes.',
    `- Add or update a test in the app's own test suite for requirement ${bug.expected.requirement}.`,
    '- No other behaviour changes. Do not edit the QA hub.',
  ].join('\n');
}

function specIndex(name) {
  // Which spec tests exist, and which bug each one guards (from knownBug markers and the "<ID>" in the title).
  const out = [];
  for (const suite of ['regression', 'smoke']) {
    const dir = join(qaDir(name), 'specs', suite);
    for (const f of listDir(dir, (f) => /\.spec\.m?[jt]s$/.test(f))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/\btest\(\s*(['"`])(.+?)\1\s*,\s*async[\s\S]*?(?=\n\s*test\(|\n\}\);?\s*$|$)/g)) {
        const known = /knownBug\(\s*['"]([A-Z][A-Z0-9]*-\d+)['"]/.exec(m[0]);
        const reqs = [...new Set([...m[2].matchAll(/\bR\d+\b/g)].map((r) => r[0]))];
        out.push({ suite, file: rel(join(dir, f)), title: m[2], bug: known?.[1] || null, requirements: reqs });
      }
    }
  }
  return out;
}

const data = { generated: new Date().toISOString(), hub: reg.hub?.name || 'QA hub', timezone: reg.hub?.timezone || 'UTC', apps: [], bugs: [], runs: [], coverage: [] };

for (const name of appNames()) {
  const a = app(name);
  const sv = existsSync(join(qaDir(name), 'source-version.json')) ? readJson(join(qaDir(name), 'source-version.json')) : null;
  const specs = specIndex(name);
  const appRuns = runs(name).map((r) => {
    const specFiles = listDir(r.dir, (f) => /^specs-.+\.json$/.test(f)).map((f) => readJson(join(r.dir, f)));
    return {
      ...r.status,
      report: existsSync(join(r.dir, 'report.md')) ? readFileSync(join(r.dir, 'report.md'), 'utf8') : null,
      tests: specFiles.flatMap((s) => s.tests.map((t) => ({ suite: s.suite, file: t.file, title: t.title, result: t.result, knownBug: t.knownBug }))),
    };
  });
  const latestTests = appRuns.filter((r) => r.tests.length).sort((x, y) => (x.started < y.started ? -1 : 1)).at(-1)?.tests || [];
  data.apps.push({ name, owner: a.owner, repo: a.repo.url || a.repo.path, branch: a.repo.branch, environments: Object.keys(a.environments || {}), source: sv, requirements: a.requirements || null });
  for (const f of listDir(join(qaDir(name), 'bugs'), (f) => f.endsWith('.json'))) {
    const bug = readJson(join(qaDir(name), 'bugs', f));
    data.bugs.push({ app: name, ...bug, fixPrompt: fixPrompt(bug, a, specs) });
  }
  data.runs.push(...appRuns.map((r) => ({ ...r, app: name })));
  // Coverage: requirement → spec → last result (the prd-checklist deliverable reads this too).
  const checklistFile = join(qaDir(name), 'requirements.json');
  const checklist = existsSync(checklistFile) ? readJson(checklistFile).rules || [] : [];
  const reqIds = new Set([...checklist.map((r) => r.id), ...specs.flatMap((s) => s.requirements)]);
  for (const id of [...reqIds].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)))) {
    const rule = checklist.find((r) => r.id === id);
    const covering = specs.filter((s) => s.requirements.includes(id));
    data.coverage.push({
      app: name, requirement: id, text: rule?.text || '', story: rule?.story || '', link: rule?.link || '', verdict: rule?.verdict || null,
      specs: covering.map((s) => ({ ...s, last: latestTests.find((t) => t.title.endsWith(s.title) && s.file.endsWith(t.file))?.result || null })),
    });
  }
}
data.runs.sort((x, y) => (x.started < y.started ? 1 : -1));
data.bugs.sort((x, y) => x.app.localeCompare(y.app) || Number(x.id.split('-')[1]) - Number(y.id.split('-')[1]));

const boardDir = join(HUB, 'board');
for (const [k, v] of Object.entries({ bugs: data.bugs, runs: data.runs, coverage: data.coverage, apps: data.apps })) writeJson(join(boardDir, 'data', `${k}.json`), v);

const template = readFileSync(join(boardDir, 'template.html'), 'utf8');
const render = (videoBase) => {
  const payload = { ...data, videoBase };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return template.replace('/*__BOARD_DATA__*/null', json);
};
writeFileSync(join(boardDir, 'index.html'), render('../'));
console.log(`board: ${data.bugs.length} bug(s), ${data.runs.length} run(s), ${data.coverage.length} requirement(s) → ${rel(join(boardDir, 'index.html'))}`);

if (dist) {
  const out = join(boardDir, 'dist');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'videos'), { recursive: true });
  for (const b of data.bugs) {
    for (const k of ['video', 'videoAfter']) {
      if (!b[k] || !existsSync(join(HUB, b[k]))) continue;
      copyFileSync(join(HUB, b[k]), join(out, 'videos', basename(b[k])));
      b[k] = `videos/${basename(b[k])}`;
    }
  }
  writeFileSync(join(out, 'index.html'), render(''));
  console.log(`board: publishable copy with videos → ${rel(out)}/ (GitHub Pages: publish this folder; Claude Artifact: publish index.html with the videos as files)`);
}
