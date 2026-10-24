#!/usr/bin/env node
// Screenshots of the example's board and one frame of a captioned bug video, for the README.
// Rebuild after UI changes with `npm run visuals` (or just this script: node docs/visuals/capture.mjs).
// Needs the example board to be built first: npm run example:board
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out');
const HUB = resolve(here, '..', '..', 'examples', 'acme-leave', 'hub');
const board = join(HUB, 'board', 'index.html');
if (!existsSync(board)) {
  console.error('The example board is not built yet. Run: npm run example:board');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const url = pathToFileURL(board).href;

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1, colorScheme: theme });
  const page = await ctx.newPage();

  await page.goto(`${url}#bugs`);
  await page.getByRole('button', { name: /AL-1/ }).waitFor();
  await page.screenshot({ path: join(OUT, `board-bugs-${theme}.png`) });

  await page.goto(`${url}#bug=AL-2`);
  await page.locator('#bug-detail video').waitFor();
  await page.locator('#bug-detail video').evaluate((v) => new Promise((r) => {
    v.addEventListener('seeked', r, { once: true });
    v.currentTime = 14;
  }));
  await page.getByTestId('copy-fix-prompt').hover();
  await page.screenshot({ path: join(OUT, `board-bug-detail-${theme}.png`) });

  await page.goto(`${url}#runs`);
  await page.locator('#tab-runs table').waitFor();
  await page.screenshot({ path: join(OUT, `board-runs-${theme}.png`) });
  await ctx.close();
}

// One frame of a captioned video: the evidence panel during the last caption of AL-1.
const ctx = await browser.newContext({ viewport: { width: 1100, height: 640 } });
const page = await ctx.newPage();
const video = pathToFileURL(join(HUB, 'qa', 'acme-leave', 'videos', 'AL-1-employee-approves-own-request.webm')).href;
await page.goto(video);
await page.locator('video').evaluate(async (v) => {
  v.pause();
  v.controls = false;
  if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
  // Playwright's webm files carry no duration. Seeking far past the end makes the browser work it out.
  if (!Number.isFinite(v.duration)) {
    await new Promise((r) => {
      v.addEventListener('durationchange', r, { once: true });
      v.currentTime = 1e6;
    });
  }
  await new Promise((r) => {
    v.addEventListener('seeked', r, { once: true });
    v.currentTime = Math.max(0, v.duration - 4.4);
  });
});
await page.locator('video').screenshot({ path: join(OUT, 'video-frame.png') });
await browser.close();
console.log(`visuals: board screenshots (light and dark) and a video frame → ${OUT}`);
