// Reads the spec files of an app: which tests exist, which requirements each one states (R-ids in the title),
// and which bug it guards (knownBug marker). Used by the board and the coverage gate.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rel, qaDir, listDir } from './hub.mjs';

export const SUITES = ['regression', 'e2e', 'smoke'];

export function specIndex(name, suites = SUITES) {
  const out = [];
  for (const suite of suites) {
    const dir = join(qaDir(name), 'specs', suite);
    for (const f of listDir(dir, (f) => /\.spec\.m?[jt]s$/.test(f))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/\btest\(\s*(['"`])(.+?)\1\s*,\s*async[\s\S]*?(?=\n\s*test\(|\n\}\);?\s*$|$)/g)) {
        const known = /knownBug\(\s*['"]([A-Z][A-Z0-9]*-\d+)['"]/.exec(m[0]);
        const title = m[2].replace(/\\(.)/g, '$1');
        const reqs = [...new Set([...title.matchAll(/\bR\d+\b/g)].map((r) => r[0]))];
        out.push({ suite, file: rel(join(dir, f)), title, bug: known?.[1] || null, requirements: reqs });
      }
    }
  }
  return out;
}
