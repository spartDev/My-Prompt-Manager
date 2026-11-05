import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', 'prepare.mjs');

/** The environment of a developer machine: no CI variables, no HUSKY, no Git variables from an enclosing hook. */
const localEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (['CI', 'GITHUB_ACTIONS', 'JENKINS_URL', 'BUILDKITE', 'HUSKY'].includes(name) || name.startsWith('GIT_')) {
      delete env[name];
    }
  }
  return env;
};

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', env: localEnv() }).trim();

const hooksPath = (cwd: string) => spawnSync('git', ['config', '--local', 'core.hooksPath'], { cwd, encoding: 'utf8', env: localEnv() }).stdout.trim();

const runPrepare = (cwd: string, env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8', env: { ...localEnv(), ...env } });

describe('prepare', () => {
  let root: string;
  let main: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'prepare-')));
    main = path.join(root, 'main');
    git(root, 'init', '--quiet', main);
    git(main, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'init');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('installs the hooks in the main checkout with an absolute core.hooksPath', () => {
    const result = runPrepare(main);

    expect(result.status).toBe(0);
    expect(hooksPath(main)).toBe(path.join(main, '.husky', '_'));
    expect(existsSync(path.join(main, '.husky', '_', 'pre-commit'))).toBe(true);
  });

  it('leaves core.hooksPath unchanged in a linked worktree', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    git(main, 'config', 'core.hooksPath', '/main/checkout/.husky/_');

    const result = runPrepare(worktree);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Linked worktree detected');
    expect(hooksPath(main)).toBe('/main/checkout/.husky/_');
    expect(existsSync(path.join(worktree, '.husky'))).toBe(false);
  });

  it.each([{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }])('skips husky in CI (%o)', (env) => {
    const result = runPrepare(main, env);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CI detected, skipping husky');
    expect(hooksPath(main)).toBe('');
  });

  it('respects HUSKY=0 in the main checkout', () => {
    const result = runPrepare(main, { HUSKY: '0' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('HUSKY=0 skip install');
    expect(hooksPath(main)).toBe('');
  });

  it('skips husky outside a Git checkout', () => {
    const result = runPrepare(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Not in a Git checkout');
  });
});
