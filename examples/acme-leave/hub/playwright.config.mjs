// Regression suite: every spec in qa/<app>/specs/regression. Run with `npm run regression`.
import { defineConfig } from '@playwright/test';
import { projects, webServers } from './tools/lib/pw.mjs';

export default defineConfig({
  outputDir: 'test-results/regression',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: projects('regression'),
  webServer: webServers(),
});
