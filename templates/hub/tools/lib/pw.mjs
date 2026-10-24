// Builds Playwright projects from registry.yaml, so adding an app to the registry adds it to every suite.
import { join } from 'node:path';
import { HUB, appNames, app, targetEnv, envConfig } from './hub.mjs';

export function projects(suite, extra = {}) {
  const env = targetEnv();
  return appNames()
    .filter((name) => app(name).environments?.[env])
    .map((name) => ({
      name: `${name}-${suite}`,
      testDir: join(HUB, 'qa', name, suite === 'videos' ? 'videos/demos' : `specs/${suite}`),
      metadata: { app: name },
      use: { baseURL: envConfig(name, env).url, appName: name, ...extra },
    }));
}

// For local targets, Playwright starts each app that has a `start` command in the registry.
export function webServers() {
  const env = targetEnv();
  if (env !== 'local' || process.env.QA_NO_SERVER === '1') return undefined;
  const servers = appNames()
    .map((name) => ({ name, e: app(name).environments?.local }))
    .filter(({ e }) => e?.start)
    .map(({ e }) => ({
      command: e.start.command,
      cwd: HUB,
      url: new URL(e.start.ready || '/', e.url).href,
      env: { ...process.env, ...(e.start.env || {}) },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
    }));
  return servers.length ? servers : undefined;
}
