#!/usr/bin/env node
// Turns the generated key mark (flat colours on an off-white background) into a trimmed PNG with a transparent
// background, so it sits on light and dark backgrounds alike. Run by `npm run visuals`.
//   docs/brand/key-mark-original.png  → docs/brand/key-mark.png (512 px) and docs/brand/favicon.png (64 px)
/* global Image, OffscreenCanvas */ // used inside page.evaluate, which runs in the browser
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = `data:image/png;base64,${readFileSync(join(here, 'key-mark-original.png')).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = new OffscreenCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  // Background colour = median of the four corners.
  const corner = [[2, 2], [c.width - 3, 2], [2, c.height - 3], [c.width - 3, c.height - 3]].map(([x, y]) => {
    const i = (y * c.width + x) * 4;
    return [p[i], p[i + 1], p[i + 2]];
  });
  const bg = [0, 1, 2].map((k) => corner.map((q) => q[k]).sort((a, b) => a - b)[2]);
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const dist = Math.hypot(p[i] - bg[0], p[i + 1] - bg[1], p[i + 2] - bg[2]);
      // Soft edge: pixels close to the background fade out, which keeps anti-aliasing smooth.
      const a = Math.max(0, Math.min(1, (dist - 10) / 40));
      if (a > 0 && a < 1) {
        // Un-blend the background so edge pixels keep the mark's colour.
        for (let k = 0; k < 3; k++) p[i + k] = Math.max(0, Math.min(255, Math.round((p[i + k] - bg[k] * (1 - a)) / a)));
      }
      p[i + 3] = Math.round(a * 255);
      if (a > 0.5) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  g.putImageData(d, 0, 0);
  const pad = 12;
  const side = Math.max(maxX - minX, maxY - minY) + pad * 2;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const render = async (size) => {
    const o = new OffscreenCanvas(size, size);
    const og = o.getContext('2d');
    og.imageSmoothingQuality = 'high';
    og.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
    const blob = await o.convertToBlob({ type: 'image/png' });
    return [...new Uint8Array(await blob.arrayBuffer())];
  };
  return { mark: await render(512), favicon: await render(64), bg };
}, src);
await browser.close();
writeFileSync(join(here, 'key-mark.png'), Buffer.from(out.mark));
writeFileSync(join(here, 'favicon.png'), Buffer.from(out.favicon));
console.log(`brand: key-mark.png (512) and favicon.png (64), background ${out.bg.join(',')} removed`);
