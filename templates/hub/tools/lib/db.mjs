// Database access for test runs, with the safety rules of docs/safety.md built in.
//
//   read(app, sql)                   any environment where a role is configured (prod only with a read-only role)
//   write(app, {sql, table, ids})    local: free, but only when QA_ISOLATED_DB names the local database
//                                    dev/staging: only rows this run created (ledger) or the hub's permanent test
//                                    accounts, one transaction, row cap, before/after logged, SQL committed
//                                    prod: never
//
// Engines: sqlite (built-in), postgres (psql), mysql/mariadb (mysql). Secrets come from env or the OS keychain.
// When the database is not exposed, registry `db.tunnel` opens an SSH tunnel first (or `db.vpn` says which VPN to join).
import { DatabaseSync } from 'node:sqlite';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { HUB, envConfig, targetEnv, registry, secret, appendJsonl, readJsonl, qaDir, runsDir, HubError } from './hub.mjs';

export class DbSafetyError extends HubError {}

const quote = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
export const sqlValue = quote;

function dbConf(appName, env) {
  const e = envConfig(appName, env);
  if (!e.db) throw new HubError(`${appName}/${env}: no db section in registry.yaml`);
  return { env, ...e.db };
}

const tunnels = new Map();
async function ensureTunnel(c) {
  if (!c.tunnel || tunnels.has(c.host)) return;
  const { via, localPort, remoteHost = c.host, remotePort = c.port } = c.tunnel;
  const child = spawn('ssh', ['-N', '-o', 'ExitOnForwardFailure=yes', '-L', `${localPort}:${remoteHost}:${remotePort}`, via], { stdio: 'ignore' });
  tunnels.set(c.host, child);
  process.on('exit', () => child.kill());
  await new Promise((r) => setTimeout(r, 1500));
  if (child.exitCode !== null) throw new HubError(`ssh tunnel via ${via} failed to start (is your SSH key loaded?)`);
}

function cli(c, sql) {
  const host = c.tunnel ? '127.0.0.1' : c.host;
  const port = String(c.tunnel ? c.tunnel.localPort : c.port);
  const user = c.user ? secret(c.user, 'database user') : undefined;
  const password = c.password ? secret(c.password, 'database password') : undefined;
  if (c.engine === 'postgres') {
    return execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-F', '\t', '--pset=footer=off', '-h', host, '-p', port, ...(user ? ['-U', user] : []), '-d', c.name, '-c', sql],
      { encoding: 'utf8', env: { ...process.env, PGPASSWORD: password || '' } });
  }
  if (c.engine === 'mysql' || c.engine === 'mariadb') {
    return execFileSync('mysql', ['--batch', '-h', host, '-P', port, ...(user ? ['-u', user] : []), c.name, '-e', sql],
      { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: password || '' } });
  }
  throw new HubError(`unsupported engine ${c.engine}`);
}

function tsvRows(out) {
  const lines = out.split('\n').filter((l) => l.length);
  if (!lines.length) return [];
  const head = lines[0].split('\t');
  return lines.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [head[i], v === 'NULL' ? null : v])));
}

function sqliteFile(c) {
  return resolve(HUB, c.file);
}

async function query(c, sql) {
  if (c.engine === 'sqlite') {
    const db = new DatabaseSync(sqliteFile(c), { readOnly: !c.__write });
    try {
      return /^\s*(select|with|pragma)/i.test(sql) ? db.prepare(sql).all() : (db.exec(sql), []);
    } finally {
      db.close();
    }
  }
  await ensureTunnel(c);
  return tsvRows(cli(c, sql));
}

// Read-only query. Refuses anything that is not a SELECT/WITH so a read can never change data.
export async function read(appName, sql, env = targetEnv()) {
  if (!/^\s*(select|with)\b/i.test(sql) || /;\s*\S/.test(sql)) throw new DbSafetyError('read() takes a single SELECT statement');
  const c = dbConf(appName, env);
  if (env === 'prod' && c.access !== 'read-only') throw new DbSafetyError('production: no read-only role configured, so no DB access');
  return query(c, sql);
}

function runLedger(appName) {
  const runId = process.env.QA_RUN_ID;
  if (!runId) throw new DbSafetyError('writes need a run: set QA_RUN_ID (npm run regression and the routines do this)');
  return { runId, file: join(runsDir(appName), runId, 'ledger.jsonl') };
}

function ownedIds(appName, table, ledgerFile, env) {
  const created = readJsonl(ledgerFile).filter((e) => e.kind === 'created' && e.table === table).map((e) => String(e.id));
  const permanent = (registry().apps[appName].testAccounts?.permanentRows?.[table] || []).map(String);
  return new Set([...created, ...(env === 'local' ? [] : permanent)]);
}

function guardLocal(c) {
  const expected = c.engine === 'sqlite' ? sqliteFile(c) : c.name;
  const guard = process.env.QA_ISOLATED_DB;
  const got = c.engine === 'sqlite' && guard ? resolve(HUB, guard) : guard;
  if (!guard || got !== expected) {
    throw new DbSafetyError(`local write refused: QA_ISOLATED_DB must name the local database (${c.engine === 'sqlite' ? c.file : c.name}). This stops a wrong connection string reaching a shared database.`);
  }
  if (c.engine !== 'sqlite' && !['localhost', '127.0.0.1', '::1'].includes(c.host)) throw new DbSafetyError(`local write refused: host ${c.host} is not this machine`);
}

let actionNo = 0;
// One guarded write. `ids` are the primary keys the statement may touch; `where` must restrict to them.
//   await write('acme-leave', { table: 'requests', ids: [12], sql: "UPDATE requests SET start_date = '2030-12-31' WHERE id = 12", why: 'move to year end' })
export async function write(appName, { sql, table, ids, why, maxRows = 20, idColumn = 'id' }, env = targetEnv()) {
  const c = { ...dbConf(appName, env), __write: true };
  if (env === 'prod') throw new DbSafetyError('production is never written by the AI');
  if (!table || !Array.isArray(ids) || !ids.length) throw new DbSafetyError('write() needs table and the ids it touches');
  if (ids.length > maxRows) throw new DbSafetyError(`write() touches ${ids.length} rows, cap is ${maxRows}`);
  if (/;\s*\S/.test(sql) || /^\s*(drop|alter|truncate|create|grant|revoke)\b/i.test(sql)) throw new DbSafetyError('one INSERT, UPDATE or DELETE statement only');
  const { runId, file } = runLedger(appName);
  if (env === 'local') guardLocal(c);
  else {
    if (c.access !== 'read-write') throw new DbSafetyError(`${env}: registry says db access is ${c.access || 'none'}, not read-write`);
    if (!/^\s*insert\b/i.test(sql)) {
      const owned = ownedIds(appName, table, file, env);
      const foreign = ids.filter((id) => !owned.has(String(id)));
      if (foreign.length) throw new DbSafetyError(`${env}: rows ${foreign.join(', ')} of ${table} were not created by this run and are not permanent test rows`);
    }
  }
  const idList = ids.map(quote).join(', ');
  const select = `SELECT * FROM ${table} WHERE ${idColumn} IN (${idList})`;
  const before = /^\s*insert\b/i.test(sql) ? [] : await query(c, select);
  let after;
  if (c.engine === 'sqlite') {
    const db = new DatabaseSync(sqliteFile(c));
    try {
      db.exec('BEGIN');
      const { changes } = db.prepare(sql).run();
      if (changes > maxRows) throw new DbSafetyError(`statement changed ${changes} rows, cap is ${maxRows}; rolled back`);
      db.exec('COMMIT');
      after = db.prepare(select).all();
    } catch (err) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw err;
    } finally {
      db.close();
    }
  } else {
    const wrapped = c.engine === 'postgres' ? `BEGIN; ${sql}; COMMIT;` : `START TRANSACTION; ${sql}; COMMIT;`;
    await query(c, wrapped);
    after = await query(c, select);
  }
  actionNo++;
  const dir = join(qaDir(appName), 'db-actions');
  mkdirSync(dir, { recursive: true });
  const sqlFile = join(dir, `${runId}-${String(actionNo).padStart(2, '0')}-${table}.sql`);
  writeFileSync(sqlFile, `-- run ${runId} · ${env} · ${new Date().toISOString()}\n-- why: ${why || 'n/a'}\n${sql};\n`);
  appendJsonl(file, { at: new Date().toISOString(), kind: 'db-write', env, table, ids, why, sql, sqlFile: sqlFile.slice(HUB.length + 1), before, after });
  return after;
}

// Records a row the run created, so later writes and cleanup may touch it.
export function recordCreated(appName, { table, id, via = 'api', cleanup }) {
  const { file } = runLedger(appName);
  appendJsonl(file, { at: new Date().toISOString(), kind: 'created', table, id, via, cleanup });
}

export function hasDb(appName, env = targetEnv()) {
  try {
    const c = dbConf(appName, env);
    return c.engine !== 'sqlite' || existsSync(sqliteFile(c));
  } catch {
    return false;
  }
}
