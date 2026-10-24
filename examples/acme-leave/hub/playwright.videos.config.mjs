// Captioned bug videos: qa/<app>/videos/demos/*.demo.mjs → qa/<app>/videos/<ID>-<slug>.webm. Run with `npm run videos`.
import { defineConfig } from '@playwright/test';
import { projects, webServers } from './tools/lib/pw.mjs';

export default defineConfig({
  outputDir: 'test-results/videos',
  testMatch: /.*\.demo\.mjs$/,
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: { headless: true, viewport: { width: 1100, height: 640 }, video: { mode: 'on', size: { width: 1100, height: 640 } } },
  projects: projects('videos'),
  webServer: webServers(),
});
