#!/usr/bin/env node
// Downloads or updates each app's source into apps/<env>/<app> (read-only) and records what was checked out.
//
//   npm run sync                       tip of the branch in registry.yaml (what developers have pushed so far)
//   npm run sync -- --deployed         the commit the environment actually runs (from its /version endpoint or deploy record)
//   npm run sync -- --app acme-leave --env dev
//   npm run sync:tip                   only report how far the tip is ahead of what was checked out and last tested
//
// Tokens come from an environment variable or the OS keychain and are passed per command, never written to disk.
import { existsSync, rmSync, cpSync, mkdirSync, readdirSync, lstatSync, chmodSync, renameSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HUB, rel, app, appNames, targetEnv, appDir, qaDir, runs, secret, sh, has, git, writeJson, fail, HubError } from './lib/hub.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(name);
const env = opt('--env') || targetEnv();
const only = opt('--app');
const mode = flag('--deployed') ? 'deployed' : 'tip';
const tipOnly = flag('--tip-only');
const wantGraph = !flag('--no-graph');

// Locks (or unlocks) the working tree so nothing edits the app source by accident. .git stays writable for fetch.
// Unlocking does a folder before its contents; locking does the contents first, while the folder is still writable.
function setWritable(dir, writable) {
  if (!existsSync(dir)) return;
  const walk = (p) => {
    for (const f of readdirSync(p)) {
      if (p === dir && f === '.git') continue;
      const q = join(p, f);
      const st = lstatSync(q);
      if (st.isSymbolicLink()) continue;
      if (writable) chmodSync(q, st.mode | 0o200);
      if (st.isDirectory()) walk(q);
      if (!writable) chmodSync(q, st.mode & ~0o222);
    }
  };
  walk(dir);
}

function authArgs(a) {
  if (!a.repo.token) return [];
  const token = secret(a.repo.token, `${a.name} repository token`);
  const user = a.repo.provider === 'gitlab' ? 'oauth2' : 'x-access-token';
  return ['-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`];
}

async function deployedSha(a) {
  const e = a.environments[env];
  if (a.version?.recordFile) {
    const file = resolve(HUB, a.version.recordFile.replace('{env}', env));
    if (existsSync(file)) return readFileSync(file, 'utf8').trim().split(/\s+/)[0];
  }
  if (a.version?.path && e.url) {
    try {
      const res = await fetch(new URL(a.version.path, e.url), { signal: AbortSignal.timeout(10_000) });
      const body = await res.json();
      const sha = body[a.version.field || 'sha'];
      if (/^[0-9a-f]{7,40}$/i.test(sha || '')) return sha;
    } catch {
      // not reachable or not JSON: treated as unknown below
    }
  }
  return null;
}

function lastTested(name) {
  const done = runs(name).filter((r) => r.status.status === 'complete' && r.status.environment === env);
  return done.at(-1)?.status.versions?.new || null;
}

function refuseCommitsHook(dir) {
  const hooks = join(dir, '.git', 'hooks');
  mkdirSync(hooks, { recursive: true });
  const body = '#!/bin/sh\necho "This is a read-only copy kept by the QA hub. Change the app in its own repo, not here." >&2\nexit 1\n';
  for (const h of ['pre-commit', 'pre-push', 'pre-merge-commit']) writeFileSync(join(hooks, h), body, { mode: 0o755 });
}

function buildGraph(name, dir) {
  if (!wantGraph) return null;
  if (!has('graphify')) {
    console.log('  graph: graphify not installed, skipped (npm run init installs it)');
    return null;
  }
  const out = join(HUB, 'graphify-out', env, name);
  try {
    sh('graphify', ['update', dir], { timeout: 600_000 });
    rmSync(out, { recursive: true, force: true });
    mkdirSync(join(out, '..'), { recursive: true });
    renameSync(join(dir, 'graphify-out'), out);
    console.log(`  graph: ${rel(out)}/graph.json (query with: graphify query "<question>" --graph ${rel(out)}/graph.json)`);
    return rel(out);
  } catch (err) {
    console.log(`  graph: graphify failed (${String(err.message).split('\n')[0]}), continuing without it`);
    return null;
  }
}

async function syncGit(a, dir) {
  const { url, branch } = a.repo;
  const auth = authArgs(a);
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(join(dir, '..'), { recursive: true });
    console.log(`  clone ${url} (${branch})`);
    sh('git', [...auth, 'clone', '--no-checkout', '--branch', branch, url, dir], { timeout: 900_000 });
  }
  if (!tipOnly) console.log(`  fetch ${branch}`);
  sh('git', [...auth, '-C', dir, 'fetch', '--quiet', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { timeout: 900_000 });
  const tipSha = git(dir, 'rev-parse', `origin/${branch}`);
  const dSha = await deployedSha(a);
  if (mode === 'deployed' && !dSha) throw new HubError(`--deployed: could not read the deployed commit of ${a.name} on ${env} (set version.path or version.recordFile in registry.yaml)`);
  if (dSha) {
    try { git(dir, 'cat-file', '-e', `${dSha}^{commit}`); } catch { sh('git', [...auth, '-C', dir, 'fetch', '--quiet', 'origin', dSha]); }
  }
  const target = mode === 'deployed' ? dSha : tipSha;
  let current = null;
  try { current = git(dir, 'rev-parse', 'HEAD'); } catch { /* cloned but never checked out */ }
  if (!tipOnly) {
    setWritable(dir, true);
    git(dir, 'checkout', '--quiet', '--force', '--detach', target);
    git(dir, 'clean', '-fdxq');
    refuseCommitsHook(dir);
  }
  const aheadBy = dSha ? Number(git(dir, 'rev-list', '--count', `${dSha}..${tipSha}`)) : null;
  const log = (from, to) => (from && from !== to ? git(dir, 'log', '--oneline', `${from}..${to}`).split('\n').filter(Boolean) : []);
  const files = (from, to) => (from && from !== to ? git(dir, 'diff', '--name-only', from, to).split('\n').filter(Boolean) : []);
  return { tipSha, deployedSha: dSha, checkedOut: tipOnly ? current : target, aheadBy, log, files };
}

async function syncPath(a, dir) {
  // A local folder (used by the offline example): copied, not cloned. The commit is the last one touching that folder.
  const src = resolve(HUB, a.repo.path);
  if (!existsSync(src)) throw new HubError(`${a.name}: repo.path ${a.repo.path} does not exist`);
  let tipSha = 'uncommitted';
  let repoRoot = null;
  try {
    repoRoot = sh('git', ['-C', src, 'rev-parse', '--show-toplevel']);
    tipSha = sh('git', ['-C', src, 'log', '-1', '--format=%H', '--', '.']) || 'uncommitted';
  } catch { /* not in git */ }
  if (!tipOnly) {
    setWritable(dir, true);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, '..'), { recursive: true });
    cpSync(src, dir, { recursive: true, filter: (p) => !/[/\\](node_modules|data|graphify-out|\.git)([/\\]|$)/.test(p.slice(src.length)) });
  }
  const dSha = await deployedSha(a);
  const inRepo = (fn) => { try { return fn(); } catch { return []; } };
  const log = (from, to) => (repoRoot && from && from !== to ? inRepo(() => sh('git', ['-C', src, 'log', '--oneline', `${from}..${to}`, '--', '.']).split('\n').filter(Boolean)) : []);
  const files = (from, to) => (repoRoot && from && from !== to ? inRepo(() => sh('git', ['-C', src, 'diff', '--name-only', '--relative', from, to, '--', '.']).split('\n').filter(Boolean)) : []);
  return { tipSha, deployedSha: dSha && dSha !== 'unknown' ? dSha : null, checkedOut: tipSha, aheadBy: null, log, files };
}

async function main() {
  const names = only ? [only] : appNames();
  let failed = 0;
  for (const name of names) {
    const a = app(name);
    if (!a.environments?.[env]) {
      if (only) fail(`${name} has no "${env}" environment`);
      continue;
    }
    if (env === 'prod' && mode === 'tip' && !tipOnly) console.log('  note: prod usually runs the deployed commit; consider --deployed');
    const dir = appDir(env, name);
    console.log(`\n${name} (${env}) → ${rel(dir)}`);
    try {
      const r = a.repo.provider === 'path' ? await syncPath(a, dir) : await syncGit(a, dir);
      const tested = lastTested(name);
      const commits = r.log(tested, r.tipSha);
      const changed = r.files(tested, r.tipSha);
      if (tipOnly) {
        console.log(`  tip         ${r.tipSha}`);
        console.log(`  checked out ${r.checkedOut || '(nothing yet)'}`);
        console.log(`  last tested ${tested || '(never)'}`);
        if (r.deployedSha) console.log(`  deployed    ${r.deployedSha}${r.aheadBy !== null ? ` (tip is ${r.aheadBy} commit(s) ahead)` : ''}`);
        if (commits.length) console.log(`  new since last tested:\n    ${commits.slice(0, 30).join('\n    ')}`);
        if (changed.length) console.log(`  files changed:\n    ${changed.slice(0, 50).join('\n    ')}`);
        continue;
      }
      const graph = buildGraph(name, dir);
      setWritable(dir, false);
      const record = {
        app: name,
        environment: env,
        provider: a.repo.provider,
        source: a.repo.url || a.repo.path,
        branch: a.repo.branch || null,
        mode,
        checkedOut: r.checkedOut,
        tipSha: r.tipSha,
        deployedSha: r.deployedSha,
        tipAheadOfDeployed: r.aheadBy,
        lastTested: tested,
        commitsSinceLastTested: commits.length,
        filesChangedSinceLastTested: changed,
        graph,
        syncedAt: new Date().toISOString(),
      };
      writeJson(join(qaDir(name), 'source-version.json'), record);
      console.log(`  checked out ${r.checkedOut} (${mode}), read-only. Wrote ${rel(join(qaDir(name), 'source-version.json'))}`);
    } catch (err) {
      failed++;
      console.error(`  ✖ ${err.message.split('\n')[0]}`);
    }
  }
  if (failed) process.exit(1);
}

main();
