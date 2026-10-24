// Smoke suite: short and read-only, safe against any environment (production included).
// Run with `npm run smoke`, or QA_ENV=staging npm run smoke.
import { defineConfig } from '@playwright/test';
import { projects, webServers } from './tools/lib/pw.mjs';

export default defineConfig({
  outputDir: 'test-results/smoke',
  workers: 1,
  retries: 1,
  timeout: 20_000,
  reporter: 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: projects('smoke'),
  webServer: webServers(),
});
