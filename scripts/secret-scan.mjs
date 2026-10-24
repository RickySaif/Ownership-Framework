#!/usr/bin/env node
// Secret and privacy scan for a public repo.
//   node scripts/secret-scan.mjs            scan staged files (pre-commit)
//   node scripts/secret-scan.mjs --all      scan every tracked file
//   node scripts/secret-scan.mjs --history  scan every version of every file in git history
// Blocks: tokens and keys, private keys, passwords in files, e-mail addresses and hosts
// that are not fictional (*.example, localhost) or on the public allowlist, and any word
// listed in .secret-scan-deny.local (one per line, never committed).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const mode = process.argv.includes('--history') ? 'history' : process.argv.includes('--all') ? 'all' : 'staged';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });

const BINARY = /\.(png|jpe?g|gif|webp|webm|mp4|ico|woff2?|ttf|pdf|zip|gz|db|sqlite)$/i;
const SKIP_FILES = new Set(['LICENSE-docs', 'package-lock.json']);

// Hosts that may appear in docs and code. Everything else must end in .example or be local.
const ALLOWED_HOSTS = [
  'github.com', 'raw.githubusercontent.com', 'docs.github.com', 'gitlab.com', 'docs.gitlab.com',
  'creativecommons.org', 'opensource.org', 'json-schema.org', 'www.w3.org', 'w3.org',
  'playwright.dev', 'nodejs.org', 'www.npmjs.com', 'registry.npmjs.org', 'pypi.org',
  'docs.anthropic.com', 'code.claude.com', 'docs.claude.com', 'claude.ai', 'claude.com', 'www.anthropic.com', 'anthropic.com',
  'mermaid.js.org', 'brew.sh', 'docs.docker.com', 'ffmpeg.org', 'www.postgresql.org', 'dev.mysql.com',
  'gitleaks.io', 'semver.org', 'keepachangelog.com', 'www.contributor-covenant.org', 'docs.astral.sh',
  'pipx.pypa.io', 'wipo.int', 'www.wipo.int', 'dgip.go.id', 'www.dgip.go.id', 'euipo.europa.eu', 'www.uspto.gov',
  'cdn.jsdelivr.net', 'fonts.googleapis.com', 'www.apple.com',
];
const ALLOWED_EMAIL = [/@([a-z0-9-]+\.)*example$/i, /^noreply@anthropic\.com$/i, /^git@github\.com$/i, /^git@gitlab\.com$/i];

const PK = '-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----';
const RULES = [
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Anthropic/OpenAI key', /\bsk-(ant-)?[A-Za-z0-9_-]{24,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Private key', new RegExp(PK)],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{30,}=*/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Connection string with password', /\b(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis):\/\/[^\s:/@]+:[^\s@/]{3,}@/i],
  ['Password in file', /\b(pass(word)?|pwd|secret|api[_-]?key|token)\b\s*[:=]\s*['"](?![[{<])[^'"\s{}$]{6,}['"]/i],
];
// Fictional demo values that are fine to publish (the offline example app's demo password).
const ALLOWED_VALUES = ['acme-demo'];

const deny = existsSync('.secret-scan-deny.local')
  ? readFileSync('.secret-scan-deny.local', 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
  : [];

function scanText(label, text) {
  const problems = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('secret-scan: allow')) return;
    for (const [name, re] of RULES) {
      const m = line.match(re);
      if (m && !ALLOWED_VALUES.some((v) => m[0].includes(v))) problems.push(`${label}:${i + 1}  ${name}`);
    }
    for (const m of line.matchAll(/\bhttps?:\/\/([a-z0-9.-]+)(:\d+)?/gi)) {
      const host = m[1].toLowerCase().replace(/\.$/, '');
      const ok = host === 'localhost' || /^127\.|^0\.0\.0\.0$/.test(host) || host.endsWith('.example') || host === 'example'
        || host.endsWith('.localhost') || ALLOWED_HOSTS.includes(host);
      if (!ok) problems.push(`${label}:${i + 1}  host not fictional or allowlisted: ${host}`);
    }
    for (const m of line.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+\b/g)) {
      const email = m[0];
      if (/^[^@]+@\d/.test(email) || /@(playwright|eslint|types|anthropic-ai)\//.test(line.slice(m.index - 1, m.index + email.length + 2))) continue;
      if (/\.(js|mjs|json|ts|md|png|webm)$/i.test(email)) continue;
      if (!ALLOWED_EMAIL.some((re) => re.test(email))) problems.push(`${label}:${i + 1}  e-mail not fictional: ${email}`);
    }
    for (const word of deny) {
      if (line.toLowerCase().includes(word.toLowerCase())) problems.push(`${label}:${i + 1}  denied word (from .secret-scan-deny.local)`);
    }
  });
  return problems;
}

let problems = [];
if (mode === 'history') {
  const revs = git('rev-list', '--all').split('\n').filter(Boolean);
  const seen = new Set();
  for (const rev of revs) {
    for (const row of git('ls-tree', '-r', rev).split('\n').filter(Boolean)) {
      const [meta, path] = row.split('\t');
      const blob = meta.split(' ')[2];
      if (seen.has(blob) || BINARY.test(path) || SKIP_FILES.has(path.split('/').pop())) continue;
      seen.add(blob);
      problems.push(...scanText(`${rev.slice(0, 7)}:${path}`, git('cat-file', '-p', blob)));
    }
    const msg = git('log', '-1', '--format=%an <%ae>%n%cn <%ce>%n%B', rev);
    problems.push(...scanText(`${rev.slice(0, 7)}:commit-message`, msg.split('\n').slice(2).join('\n')));
  }
} else {
  const files = mode === 'all'
    ? git('ls-files', '-co', '--exclude-standard').split('\n')
    : git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n');
  for (const f of files.filter(Boolean)) {
    if (BINARY.test(f) || SKIP_FILES.has(f.split('/').pop()) || !existsSync(f)) continue;
    const text = mode === 'staged' ? git('show', `:${f}`) : readFileSync(f, 'utf8');
    problems.push(...scanText(f, text));
  }
}

problems = [...new Set(problems)];
if (problems.length) {
  console.error(`secret-scan (${mode}): ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  console.error('\nFix the file, or if the value is truly public and fictional, add "secret-scan: allow" on that line.');
  process.exit(1);
}
console.log(`secret-scan (${mode}): clean`);
