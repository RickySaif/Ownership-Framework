#!/usr/bin/env node
// Checks the README visuals: every SVG source has a light and a dark render, every image is under 500 KB,
// and every image the README points to exists.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'docs/visuals';
const out = join(dir, 'out');
const LIMIT = 500 * 1024;
const problems = [];
for (const svg of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  for (const theme of ['light', 'dark']) {
    const png = join(out, svg.replace('.svg', `-${theme}.png`));
    if (!existsSync(png)) problems.push(`${png} missing: run npm run visuals`);
  }
}
for (const f of readdirSync(out)) {
  const size = statSync(join(out, f)).size;
  if (size > LIMIT) problems.push(`${join(out, f)} is ${Math.round(size / 1024)} KB (limit 500 KB)`);
}
const readme = readFileSync('README.md', 'utf8');
for (const m of readme.matchAll(/(?:src|srcset)="([^"]+)"|!\[[^\]]*\]\(([^)]+)\)/g)) {
  const p = m[1] || m[2];
  if (!/^https?:/.test(p) && !existsSync(p)) problems.push(`README.md points to ${p}, which does not exist`);
}
if (problems.length) {
  console.error('visuals:\n  ✖ ' + problems.join('\n  ✖ '));
  process.exit(1);
}
console.log('visuals: all renders present, all under 500 KB, all README images exist');
