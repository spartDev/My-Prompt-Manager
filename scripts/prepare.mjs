/**
 * npm 'prepare': installs the husky Git hooks, safely in any checkout.
 * Every worktree of a repository shares one .git/config, and husky writes the relative path '.husky/_' to its
 * core.hooksPath, which breaks the hooks of every other checkout. So the script:
 * - skips husky in CI;
 * - skips husky in a linked worktree (its git dir differs from the common git dir), leaving core.hooksPath as it is;
 * - in the main checkout, runs husky, then sets core.hooksPath to the absolute path of .husky/_.
 */
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';

const CI_VARIABLES = ['GITHUB_ACTIONS', 'JENKINS_URL', 'BUILDKITE'];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const skip = (reason) => {
  process.stdout.write(`${reason}, skipping husky\n`);
  process.exit(0);
};

if (process.env.CI === 'true' || CI_VARIABLES.some((name) => process.env[name])) {
  skip('CI detected');
}

let gitDir;
let commonDir;
let topLevel;
try {
  [gitDir, commonDir, topLevel] = git('rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir', '--show-toplevel').split('\n');
} catch {
  skip('Not in a Git checkout');
}

if (realpathSync(gitDir) !== realpathSync(commonDir)) {
  skip('Linked worktree detected (core.hooksPath is shared with the main checkout)');
}

// Imported only here, so CI and linked worktrees never need husky installed.
const { default: husky } = await import('husky');
const message = husky();
if (message) {
  process.stdout.write(`${message}\n`);
  process.exit(0);
}
git('config', 'core.hooksPath', path.join(topLevel, '.husky', '_'));
