// Captioned bug videos. Each demo records headless, with captions and an evidence panel burned into the page,
// and is saved as qa/<app>/videos/<ID>-<slug>.webm.
//
//   import { demo, caption, evidence, as } from '../../../lib/demo.mjs';
//   demo('AL-1 employee approves own request', async ({ page }) => {
//     await as(page, 'employee');
//     await caption('Ben, an employee, requests one day off');
//     …
//     await evidence({ title: 'Stored state', rows: { status: 'approved', decided_by: 'Ben (himself)' } });
//   });
//
// Run with `npm run videos` (uses playwright.videos.config.mjs). Add AFTER=1 to record the "after fix" clip,
// saved as <ID>-<slug>.after.webm.
/* global document */ // used inside page.evaluate, which runs in the browser
import { test as qaTest, loginPage } from './qa.mjs';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qaDir, has, sh } from '../tools/lib/hub.mjs';

let current = null;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY = `
(() => {
  if (window.__qaOverlay) return;
  window.__qaOverlay = true;
  const style = document.createElement('style');
  style.textContent = \`
    #qa-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:80%;z-index:2147483647;
      background:rgba(17,24,39,.92);color:#fff;font:600 20px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:10px;
      box-shadow:0 6px 24px rgba(0,0,0,.3);text-align:center;transition:opacity .2s}
    #qa-badge{position:fixed;bottom:34px;left:16px;z-index:2147483647;background:#0f766e;color:#fff;font:700 13px system-ui;
      padding:4px 10px;border-radius:999px;letter-spacing:.03em}
    #qa-evidence{position:fixed;top:12px;right:12px;width:340px;z-index:2147483647;background:#0f172a;color:#e2e8f0;
      font:13px/1.45 ui-monospace,Menlo,monospace;border-radius:10px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.35);
      border-left:4px solid #f59e0b}
    #qa-evidence h4{margin:0 0 6px;font:700 13px system-ui;color:#fbbf24;text-transform:uppercase;letter-spacing:.05em}
    #qa-evidence .k{color:#94a3b8} #qa-evidence .bad{color:#fca5a5;font-weight:700} #qa-evidence .good{color:#86efac}\`;
  document.documentElement.appendChild(style);
})();`;

async function paint(page) {
  if (!current) return;
  await page.evaluate(OVERLAY).catch(() => {});
  await page.evaluate(({ badge, text, panel }) => {
    const el = (id) => document.getElementById(id) || Object.assign(document.body.appendChild(document.createElement('div')), { id });
    el('qa-badge').textContent = badge;
    const c = el('qa-caption');
    c.textContent = text || '';
    c.style.opacity = text ? '1' : '0';
    const e = document.getElementById('qa-evidence');
    if (!panel) { if (e) e.remove(); return; }
    const box = el('qa-evidence');
    box.replaceChildren();
    const h = document.createElement('h4');
    h.textContent = panel.title || 'Evidence';
    box.append(h);
    for (const [k, v] of Object.entries(panel.rows || {})) {
      const line = document.createElement('div');
      const key = document.createElement('span');
      key.className = 'k';
      key.textContent = k + ': ';
      const val = document.createElement('span');
      val.textContent = typeof v === 'object' && v !== null ? (v.value ?? JSON.stringify(v)) : String(v);
      if (v && v.bad) val.className = 'bad';
      if (v && v.good) val.className = 'good';
      line.append(key, val);
      box.append(line);
    }
  }, { badge: current.badge, text: current.text, panel: current.panel }).catch(() => {});
}

// Shows a caption at the bottom of the video and holds it long enough to read.
export async function caption(text, { hold } = {}) {
  if (!current) throw new Error('[helper] caption() used outside demo()');
  current.text = text;
  await paint(current.page);
  await pause(hold ?? Math.min(4000, 1200 + text.length * 35));
}

// Shows the evidence panel (top right): what the response said and what is stored. Values can be
// { value, bad: true } or { value, good: true } to colour them.
export async function evidence(panel, { hold = 2500 } = {}) {
  if (!current) throw new Error('[helper] evidence() used outside demo()');
  current.panel = panel;
  await paint(current.page);
  await pause(hold);
}

// Logs the page in as a role (UI login from registry.yaml), with a caption.
export async function as(page, role) {
  if (!current) throw new Error('[helper] as() used outside demo()');
  const acc = await loginPage(page, current.appName, role);
  await caption(`Logged in as ${role} (${acc.user})`, { hold: 1500 });
  return acc;
}

// demo('AL-2 weekend days are counted', async ({ page, as: api, db }) => { … })
export function demo(name, fn) {
  const id = name.split(' ')[0];
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(id)) throw new Error(`[helper] demo name must start with the bug id, e.g. "AL-1 …" (got "${name}")`);
  qaTest(name, async ({ page, appName, as: api, db, track }, info) => {
    const after = process.env.AFTER === '1';
    current = { page, appName, badge: `${id} · ${after ? 'after fix' : 'bug'}`, text: '', panel: null };
    page.on('load', () => paint(page));
    try {
      await fn({ page, api, db, track, appName });
      await caption('End of clip', { hold: 1200 });
    } finally {
      current = null;
      const video = page.video();
      await page.close();
      if (video && info.status === info.expectedStatus) {
        const dir = join(qaDir(appName), 'videos');
        mkdirSync(dir, { recursive: true });
        const out = join(dir, `${id}-${slug(name.slice(id.length))}${after ? '.after' : ''}.webm`);
        // Playwright's webm has no duration, so players cannot seek. ffmpeg (from npm run init) rewrites the header.
        if (has('ffmpeg')) sh('ffmpeg', ['-v', 'error', '-y', '-i', await video.path(), '-c', 'copy', out]);
        else copyFileSync(await video.path(), out);
        info.annotations.push({ type: 'video', description: out });
      }
    }
  });
}
