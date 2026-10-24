// Shared helpers for the hub tools and the test library.
// Everything here works from the hub root, whatever the current directory is.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

export const HUB = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const rel = (p) => relative(HUB, p) || '.';

// Non-secret settings (QA_ENV, QA_ISOLATED_DB, …) from qa.env at the hub root. Shell values win.
loadEnvFile(join(HUB, 'qa.env'));
export function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*([^#]*?)\s*(#.*)?$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export class HubError extends Error {}

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  assertWritable(file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function appendJsonl(file, entry) {
  assertWritable(file);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(entry) + '\n');
}

export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// Source under apps/ is read-only. No hub tool may write there except sync.
export function assertWritable(file) {
  const r = relative(join(HUB, 'apps'), resolve(file));
  if (!r.startsWith('..') && !isAbsolute(r)) {
    throw new HubError(`refusing to write inside apps/ (${rel(file)}): app source is read-only`);
  }
}

let registryCache;
export function registry() {
  if (!registryCache) {
    const file = join(HUB, 'registry.yaml');
    if (!existsSync(file)) throw new HubError('registry.yaml not found at the hub root');
    registryCache = parse(readFileSync(file, 'utf8'));
  }
  return registryCache;
}

export function appNames() {
  return Object.keys(registry().apps || {});
}

export function app(name) {
  const a = registry().apps?.[name];
  if (!a) throw new HubError(`app "${name}" is not in registry.yaml (known: ${appNames().join(', ') || 'none'})`);
  return { name, ...a };
}

export function targetEnv() {
  return process.env.QA_ENV || registry().hub?.defaultEnv || 'local';
}

export function envConfig(appName, env = targetEnv()) {
  const e = app(appName).environments?.[env];
  if (!e) throw new HubError(`app "${appName}" has no "${env}" environment in registry.yaml`);
  return { name: env, ...e };
}

export const appDir = (env, name) => join(HUB, 'apps', env, name);
export const qaDir = (name) => join(HUB, 'qa', name);
export const runsDir = (name) => join(HUB, 'runs', name);

export function listDir(dir, filter = () => true) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => filter(f, join(dir, f))).sort();
}

export const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// Run ids sort by time: 20261023-0200-nightly. Everything a run creates is named "<run-id>-…".
export function newRunId(mode = 'attended', date = new Date()) {
  const tz = registry().hub?.timezone || 'UTC';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}-${mode}`;
}

export function runs(appName) {
  return listDir(runsDir(appName), (f, p) => isDir(p) && existsSync(join(p, 'status.json')))
    .map((id) => ({ id, dir: join(runsDir(appName), id), status: readJson(join(runsDir(appName), id, 'status.json')) }));
}

export function currentRun(appName) {
  if (process.env.QA_RUN_ID) {
    const dir = join(runsDir(appName), process.env.QA_RUN_ID);
    return { id: process.env.QA_RUN_ID, dir };
  }
  return null;
}

export function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

export function has(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Secrets never live in files. A secret reference is { env: NAME } and/or { keychain: service, account? }.
// Order: environment variable, then the OS keychain (macOS Keychain, or libsecret on Linux).
export function secret(ref, what = 'secret') {
  if (!ref) throw new HubError(`no ${what} configured in registry.yaml`);
  if (ref.env && process.env[ref.env]) return process.env[ref.env];
  if (ref.keychain) {
    const account = ref.account ? ['-a', ref.account] : [];
    try {
      if (process.platform === 'darwin') return sh('security', ['find-generic-password', '-s', ref.keychain, ...account, '-w']);
      if (has('secret-tool')) return sh('secret-tool', ['lookup', 'service', ref.keychain, ...(ref.account ? ['account', ref.account] : [])]);
    } catch {
      // fall through to the error below
    }
  }
  // Only for fictional demo apps whose demo password is published on purpose (like the offline example).
  if (ref.publicDemoValue) return ref.publicDemoValue;
  const how = [ref.env && `set the ${ref.env} environment variable`, ref.keychain && `add "${ref.keychain}" to the OS keychain`].filter(Boolean).join(' or ');
  throw new HubError(`${what} not found: ${how}`);
}

// Production is read-only smoke unless CLAUDE.md and the registry record a written, time-boxed exception.
export function prodException(appName, today = new Date().toISOString().slice(0, 10)) {
  return (registry().hub?.production?.exceptions || []).find(
    (x) => (x.app === appName || x.app === '*') && x.approvedBy && x.scope && x.ends && x.ends >= today,
  ) || null;
}

export function git(dir, ...args) {
  return sh('git', ['-C', dir, ...args]);
}
