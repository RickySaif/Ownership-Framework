// The test library every hub spec imports. Plain rules, built in:
//   · helpers throw on failure (HelperError), so a broken setup can never look like a pass or a real bug
//   · everything a run creates is named "<run-id>-…" and written to the run's ledger, so cleanup touches only that
//   · knownBug('<ID>', 'reason') keeps the suite green while a bug is open, and flips when it is fixed
//
//   import { test, expect, knownBug, named } from '../../../../lib/qa.mjs';
//   test('employee cannot approve own request', async ({ as }) => {
//     knownBug('AL-1', 'self-approval is allowed');
//     const ben = await as('employee');
//     …
//   });
import { test as base, expect } from '@playwright/test';
import { join } from 'node:path';
import { app, envConfig, targetEnv, secret, appendJsonl, runsDir } from '../tools/lib/hub.mjs';
import * as db from '../tools/lib/db.mjs';

export { expect };

export class HelperError extends Error {
  constructor(message) {
    super(`[helper] ${message}`);
    this.name = 'HelperError';
  }
}

export const strict = () => process.env.REGRESSION_STRICT === '1';
export const runId = () => process.env.QA_RUN_ID || 'adhoc';
export const named = (label) => `${runId()}-${label}`;

// Marks a test whose assertions state the correct behaviour while the bug is still open.
// Normal mode: the test is expected to fail (test.fail), so the suite stays green; when the bug is fixed the
// test "unexpectedly passes" and the run reports the bug as possibly fixed.
// REGRESSION_STRICT=1: the marker is ignored, so the test fails on its real assertion. That proves the spec works.
export function knownBug(id, reason) {
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(id)) throw new HelperError(`knownBug: "${id}" is not a bug id like AL-1`);
  base.info().annotations.push({ type: 'knownBug', description: `${id}: ${reason}` });
  if (!strict()) base.fail(true, `${id}: ${reason}`);
}

function fill(template, values) {
  return JSON.parse(JSON.stringify(template), (k, v) => (typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? '') : v));
}

export function account(appName, role) {
  const a = app(appName);
  const r = a.testAccounts?.roles?.[role];
  if (!r) throw new HelperError(`no test account for role "${role}" in registry.yaml (${appName})`);
  return { role, user: r.user, password: secret(r.password, `${appName} ${role} password`) };
}

async function bodyOf(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// An API client logged in as a role. Every call returns { status, body }; ok* variants throw unless 2xx.
async function apiClient(playwright, appName, role) {
  const { url } = envConfig(appName);
  const login = app(appName).login?.api;
  if (!login) throw new HelperError(`${appName}: registry has no login.api section`);
  const acc = account(appName, role);
  const ctx = await playwright.request.newContext({ baseURL: url });
  const res = await ctx.fetch(login.path, { method: login.method || 'POST', data: fill(login.body, acc) });
  if (!res.ok()) throw new HelperError(`login as ${role} (${acc.user}) failed: HTTP ${res.status()}`);
  const me = await bodyOf(res);
  const call = async (method, path, data) => {
    let r;
    try {
      r = await ctx.fetch(path, { method, data });
    } catch (err) {
      throw new HelperError(`${method} ${path} as ${role}: ${err.message}`);
    }
    return { status: r.status(), body: await bodyOf(r) };
  };
  const ok = async (method, path, data) => {
    const r = await call(method, path, data);
    if (r.status < 200 || r.status > 299) throw new HelperError(`${method} ${path} as ${role}: expected 2xx, got ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  return {
    role, user: acc.user, me, ctx,
    get: (p) => call('GET', p), post: (p, d) => call('POST', p, d), put: (p, d) => call('PUT', p, d), delete: (p) => call('DELETE', p),
    okGet: (p) => ok('GET', p), okPost: (p, d) => ok('POST', p, d), okPut: (p, d) => ok('PUT', p, d),
  };
}

export async function loginPage(page, appName, role) {
  const ui = app(appName).login?.ui;
  if (!ui) throw new HelperError(`${appName}: registry has no login.ui section`);
  const acc = account(appName, role);
  await page.goto(ui.path || '/');
  await page.locator(ui.user).fill(acc.user);
  await page.locator(ui.password).fill(acc.password);
  await page.locator(ui.submit).click();
  try {
    await page.locator(ui.loggedIn).filter({ hasText: /\S/ }).waitFor({ timeout: 10_000 });
  } catch {
    throw new HelperError(`UI login as ${role} (${acc.user}) did not finish`);
  }
  return acc;
}

export const test = base.extend({
  // Playwright fixtures that need no other fixture take an empty pattern.
  // eslint-disable-next-line no-empty-pattern
  appName: [async ({}, use, info) => use(info.project.metadata?.app), { option: true }],
  // eslint-disable-next-line no-empty-pattern
  env: async ({}, use) => use(targetEnv()),
  // as('manager') → API client logged in as that role. Several roles in one test are fine (user A vs user B).
  as: async ({ playwright, appName }, use) => {
    const clients = [];
    await use(async (role) => {
      const c = await apiClient(playwright, appName, role);
      clients.push(c);
      return c;
    });
    for (const c of clients) await c.ctx.dispose();
  },
  // track(...) records something the run created, with how to undo it, in runs/<app>/<run-id>/ledger.jsonl.
  track: async ({ appName }, use) => {
    await use((entry) => {
      if (!entry?.table || entry.id === undefined) throw new HelperError('track() needs { table, id, cleanup }');
      appendJsonl(join(runsDir(appName), runId(), 'ledger.jsonl'), { at: new Date().toISOString(), kind: 'created', via: 'api', ...entry });
    });
  },
  // db.read(sql) for the second confirmation; db.write({...}) under the environment's write policy.
  db: async ({ appName }, use) => {
    await use({
      read: (sql) => db.read(appName, sql),
      write: (w) => db.write(appName, w),
      available: () => db.hasDb(appName),
    });
  },
});
