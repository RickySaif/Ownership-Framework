// Regression suite (qa/<app>/specs/regression, `npm run regression`) and the full e2e suite
// (qa/<app>/specs/e2e, `npm run e2e`). Both may write test data, so neither runs against production.
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
  projects: [...projects('regression'), ...projects('e2e')],
  webServer: webServers(),
});
