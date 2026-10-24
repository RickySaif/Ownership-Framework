// Runs on `npm install`: points git at .githooks so the secret scan runs before every commit.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
  console.log('git hooks: pre-commit secret scan enabled');
} catch {
  // Not a git checkout (for example an npm tarball): nothing to install.
}
