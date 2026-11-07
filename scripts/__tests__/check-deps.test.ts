// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { builtForPlatform, check, compareLockfiles, fixCommand } from '../check-deps.mjs';

const SCRIPT = path.resolve(__dirname, '..', 'check-deps.mjs');

type Entry = { version: string; optional?: boolean; os?: string[]; cpu?: string[]; libc?: string[] };
type Packages = Record<string, Entry>;

/** A package-lock.json: the project's own entry under "", then the packages. */
const lockfile = (packages: Packages) => ({
  name: 'fixture',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: { '': { name: 'fixture', version: '1.0.0' }, ...packages },
});

/** A node_modules/.package-lock.json: the installed packages, with no entry for the project itself. */
const installed = (packages: Packages) => ({ name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages });

const WANTED: Packages = { 'node_modules/vite': { version: '8.3.5' }, 'node_modules/tsx': { version: '4.23.15' } };

/** An Apple-silicon Mac, whatever this test runs on. */
const MAC = { os: 'darwin', cpu: 'arm64', libc: undefined };

/** Writes a checkout at `dir` whose lockfile lists `wanted`; `present` is what node_modules holds, or null for none. */
function writeCheckout(dir: string, wanted: Packages, present: Packages | null) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lockfile(wanted)));
  if (present !== null) {
    mkdirSync(path.join(dir, 'node_modules'));
    writeFileSync(path.join(dir, 'node_modules', '.package-lock.json'), JSON.stringify(installed(present)));
  }
}

const runCheck = (dir: string, ...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args, dir], { encoding: 'utf8' });

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

describe('compareLockfiles', () => {
  it('reports a package installed at another version than the lockfile', () => {
    const differences = compareLockfiles(lockfile(WANTED), installed({ ...WANTED, 'node_modules/vite': { version: '7.3.7' } }));

    expect(differences).toEqual([{ name: 'vite', expected: '8.3.5', installed: '7.3.7' }]);
  });

  it('reports a package the lockfile lists that is not installed', () => {
    const differences = compareLockfiles(lockfile(WANTED), installed({ 'node_modules/vite': { version: '8.3.5' } }));

    expect(differences).toEqual([{ name: 'tsx', expected: '4.23.15', installed: undefined }]);
  });

  it('reports an installed package the lockfile does not list', () => {
    const differences = compareLockfiles(lockfile(WANTED), installed({ ...WANTED, 'node_modules/rollup': { version: '4.43.0' } }));

    expect(differences).toEqual([{ name: 'rollup', expected: undefined, installed: '4.43.0' }]);
  });

  it('finds no difference when the two agree, the absent optional packages of other platforms included', () => {
    const wanted = {
      ...WANTED,
      'node_modules/@biomejs/cli-linux-x64': { version: '2.6.4', optional: true, os: ['linux'], cpu: ['x64'] },
      'node_modules/fsevents': { version: '2.3.3', optional: true, os: ['darwin'] },
      'node_modules/@rolldown/binding-linux-x64-musl': { version: '1.2.16', optional: true, os: ['linux'], cpu: ['x64'], libc: ['musl'] },
    };
    const onMac = { ...WANTED, 'node_modules/fsevents': { version: '2.3.3' } };

    expect(compareLockfiles(lockfile(wanted), installed(onMac), MAC)).toEqual([]);
    expect(compareLockfiles(lockfile(wanted), installed(WANTED), { os: 'linux', cpu: 'x64', libc: 'glibc' })).toEqual([
      { name: '@biomejs/cli-linux-x64', expected: '2.6.4', installed: undefined },
    ]);
  });

  it('reports an absent optional package built for this platform, since the toolchain needs it', () => {
    const wanted = {
      ...WANTED,
      'node_modules/@rolldown/binding-darwin-arm64': { version: '1.2.16', optional: true, os: ['darwin'], cpu: ['arm64'] },
      'node_modules/@types/trusted-types': { version: '2.0.7', optional: true },
    };

    expect(compareLockfiles(lockfile(wanted), installed(WANTED), MAC)).toEqual([
      { name: '@rolldown/binding-darwin-arm64', expected: '1.2.16', installed: undefined },
      { name: '@types/trusted-types', expected: '2.0.7', installed: undefined },
    ]);
  });

  it('expects the bundled dependencies of an optional package built for another platform to be absent with it', () => {
    const wanted = {
      ...WANTED,
      'node_modules/@tailwindcss/oxide-wasm32-wasi': { version: '4.2.2', optional: true, cpu: ['wasm32'] },
      'node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/tslib': { version: '2.8.1', optional: true },
    };

    expect(compareLockfiles(lockfile(wanted), installed(WANTED), MAC)).toEqual([]);
  });

  it('names a nested package by its path under node_modules', () => {
    const wanted = { ...WANTED, 'node_modules/jsdom/node_modules/lru-cache': { version: '10.4.3' } };

    expect(compareLockfiles(lockfile(wanted), installed(WANTED))).toEqual([
      { name: 'jsdom/node_modules/lru-cache', expected: '10.4.3', installed: undefined },
    ]);
  });
});

describe('builtForPlatform', () => {
  it.each([
    [{}, MAC, true],
    [{ os: ['darwin'], cpu: ['arm64'] }, MAC, true],
    [{ os: ['linux'] }, MAC, false],
    [{ cpu: ['x64'] }, MAC, false],
    [{ os: ['!darwin'] }, MAC, false],
    [{ os: ['!win32'] }, MAC, true],
    [{ os: ['any'] }, MAC, true],
    [{ os: ['linux'], libc: ['glibc'] }, { os: 'linux', cpu: 'x64', libc: 'glibc' }, true],
    [{ os: ['linux'], libc: ['musl'] }, { os: 'linux', cpu: 'x64', libc: 'glibc' }, false],
    [{ os: ['linux'], libc: ['musl'] }, { os: 'linux', cpu: 'x64', libc: undefined }, true],
  ])('%o on %o is %s', (entry, platform, expected) => {
    expect(builtForPlatform(entry, platform)).toBe(expected);
  });
});

describe('check-deps', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'check-deps-')));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('exits 1 and prints the package, both versions and the fix on a version difference', () => {
    writeCheckout(root, WANTED, { ...WANTED, 'node_modules/vite': { version: '7.3.7' } });

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('differs from package-lock.json in 1 package ');
    expect(result.stdout).toContain('vite: 7.3.7 installed, 8.3.5 in package-lock.json');
    expect(result.stdout).toContain('Fix: npm ci');
  });

  it('exits 1 and names a package that is not installed', () => {
    writeCheckout(root, WANTED, { 'node_modules/vite': { version: '8.3.5' } });

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('tsx: 4.23.15 in package-lock.json, not installed');
  });

  it('exits 0 and prints nothing when the two lockfiles agree', () => {
    writeCheckout(root, WANTED, WANTED);

    const result = runCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('exits 1 with the fix when node_modules is missing', () => {
    writeCheckout(root, WANTED, null);

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('node_modules is missing');
    expect(result.stdout).toContain('Fix: npm ci');
  });

  it('exits 0 with the same report under --hook, so Claude Code adds it to the context', () => {
    writeCheckout(root, WANTED, { ...WANTED, 'node_modules/vite': { version: '7.3.7' } });

    const result = runCheck(root, '--hook');

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${check(root)}\n`);
    expect(result.stdout).toContain('vite: 7.3.7 installed, 8.3.5 in package-lock.json');
  });

  it('lists at most 20 packages and counts the rest', () => {
    const present: Packages = {};
    for (let i = 0; i < 25; i++) {
      present[`node_modules/extra-${String(i).padStart(2, '0')}`] = { version: '1.0.0' };
    }
    writeCheckout(root, WANTED, { ...WANTED, ...present });

    const output = check(root);

    expect(output).toContain('in 25 packages');
    expect(output).toContain('extra-19: 1.0.0 installed, not in package-lock.json');
    expect(output).not.toContain('extra-20');
    expect(output).toContain('… and 5 more');
  });
});

describe('fixCommand', () => {
  let root: string;
  let main: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'check-deps-git-')));
    main = path.join(root, 'main');
    git(root, 'init', '--quiet', main);
    git(main, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'init');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('is npm ci in the main checkout', () => {
    expect(fixCommand(main)).toBe('npm ci (main checkout)');
  });

  it('is npm ci with HUSKY=0 in a linked worktree', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);

    expect(fixCommand(worktree)).toBe('HUSKY=0 npm ci --no-audit --no-fund (linked worktree)');
  });

  it('sends a worktree whose node_modules is a symlink into a checkout with the same lockfile to that checkout', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    mkdirSync(path.join(main, 'node_modules'));
    symlinkSync(path.join(main, 'node_modules'), path.join(worktree, 'node_modules'));
    writeFileSync(path.join(main, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));
    writeFileSync(path.join(worktree, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));

    expect(fixCommand(worktree)).toBe(
      `cd ${main} && npm ci (node_modules is a symlink into that checkout, which has the same package-lock.json; an npm ci here would rewrite it)`,
    );
  });

  it('has a worktree whose lockfile differs from the symlinked checkout replace the symlink and install its own', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    mkdirSync(path.join(main, 'node_modules'));
    symlinkSync(path.join(main, 'node_modules'), path.join(worktree, 'node_modules'));
    writeFileSync(path.join(main, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));
    writeFileSync(path.join(worktree, 'package-lock.json'), JSON.stringify(lockfile({ ...WANTED, 'node_modules/vite': { version: '8.4.0' } })));

    expect(fixCommand(worktree)).toBe(
      `rm node_modules && HUSKY=0 npm ci --no-audit --no-fund (node_modules is a symlink into ${main}, whose package-lock.json differs; rm removes only the symlink, then this checkout gets its own install)`,
    );
  });

  it('is npm ci outside a Git checkout', () => {
    expect(fixCommand(root)).toBe('npm ci (main checkout)');
  });
});
