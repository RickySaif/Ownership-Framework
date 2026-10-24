#!/usr/bin/env node
// Renders every visual from source. Part of `npm run visuals`.
//   1. the brand mark cut-out (docs/brand/cutout.mjs)
//   2. each docs/visuals/*.svg → docs/visuals/out/<name>-light.png and <name>-dark.png at 2x
// The SVGs share theme.css; the dark variant adds class="dark" to the root element.
import { chromium } from '@playwright/test';
import { readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out');
mkdirSync(OUT, { recursive: true });
execFileSync(process.execPath, [join(here, '..', 'brand', 'cutout.mjs')], { stdio: 'inherit' });

const only = process.argv.slice(2);
const sources = readdirSync(here).filter((f) => f.endsWith('.svg') && (!only.length || only.some((o) => f.startsWith(o))));
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const file of sources) {
  const name = file.replace(/\.svg$/, '');
  await page.goto(pathToFileURL(join(here, file)).href);
  const { width, height } = await page.evaluate(() => {
    const svg = document.documentElement; // eslint-disable-line no-undef
    return { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')) };
  });
  await page.setViewportSize({ width, height });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark'); // eslint-disable-line no-undef
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode?.().catch(() => {})))); // eslint-disable-line no-undef
    await page.screenshot({ path: join(OUT, `${name}-${theme}.png`), omitBackground: true, clip: { x: 0, y: 0, width, height } });
  }
  console.log(`visuals: ${file} → out/${name}-light.png, out/${name}-dark.png`);
}
await browser.close();
