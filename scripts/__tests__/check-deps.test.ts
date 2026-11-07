// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { builtForPlatform, check, compareLockfiles, fixCommand } from '../check-deps.mjs';

const SCRIPT = path.resolve(__dirname, '..', 'check-deps.mjs');

type Entry = { version: string; optional?: boolean; os?: string[]; cpu?: string[]; libc?: string[]; integrity?: string; resolved?: string };
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

/**
 * Writes a checkout at `dir` whose lockfile lists `wanted`; `present` is what node_modules holds, each package with
 * its folder and package.json, or null for no node_modules at all.
 */
function writeCheckout(dir: string, wanted: Packages, present: Packages | null) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lockfile(wanted)));
  if (present !== null) {
    mkdirSync(path.join(dir, 'node_modules'));
    writeFileSync(path.join(dir, 'node_modules', '.package-lock.json'), JSON.stringify(installed(present)));
    for (const [key, entry] of Object.entries(present)) {
      mkdirSync(path.join(dir, key), { recursive: true });
      writeFileSync(path.join(dir, key, 'package.json'), JSON.stringify({ name: key.split('node_modules/').pop(), version: entry.version }));
    }
  }
}

/** Runs the script on `dir` from inside it, as the pretest script and the SessionStart hook do. */
const runCheck = (dir: string, ...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args, dir], { cwd: dir, encoding: 'utf8' });

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

  it('reports a package of the same version whose content the lockfile changed, by its integrity', () => {
    const wanted = { ...WANTED, 'node_modules/vite': { version: '8.3.5', integrity: 'sha512-new', resolved: 'https://registry.npmjs.org/vite/-/vite-8.3.5.tgz' } };
    const present = { ...WANTED, 'node_modules/vite': { version: '8.3.5', integrity: 'sha512-old', resolved: 'https://registry.npmjs.org/vite/-/vite-8.3.5.tgz' } };

    expect(compareLockfiles(lockfile(wanted), installed(present), MAC)).toEqual([
      { name: 'vite', expected: '8.3.5', installed: '8.3.5', reason: 'integrity' },
    ]);
  });

  it('reports a Git package of the same version whose resolved revision changed, since it has no integrity', () => {
    const wanted = { ...WANTED, 'node_modules/tool': { version: '1.0.0', resolved: 'git+ssh://git@github.com/x/tool.git#aaaa' } };
    const present = { ...WANTED, 'node_modules/tool': { version: '1.0.0', resolved: 'git+ssh://git@github.com/x/tool.git#bbbb' } };

    expect(compareLockfiles(lockfile(wanted), installed(present), MAC)).toEqual([
      { name: 'tool', expected: '1.0.0', installed: '1.0.0', reason: 'resolved' },
    ]);
  });

  it('finds no difference when the integrity matches although a registry mirror changed the resolved URL', () => {
    const wanted = { ...WANTED, 'node_modules/vite': { version: '8.3.5', integrity: 'sha512-same', resolved: 'https://registry.npmjs.org/vite/-/vite-8.3.5.tgz' } };
    const present = { ...WANTED, 'node_modules/vite': { version: '8.3.5', integrity: 'sha512-same', resolved: 'https://mirror.example.com/vite/-/vite-8.3.5.tgz' } };

    expect(compareLockfiles(lockfile(wanted), installed(present), MAC)).toEqual([]);
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

  it('exits 1 and says what differs when the version is the same but the content is not', () => {
    writeCheckout(root, { ...WANTED, 'node_modules/vite': { version: '8.3.5', integrity: 'sha512-new' } }, { ...WANTED, 'node_modules/vite': { version: '8.3.5', integrity: 'sha512-old' } });

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('vite: 8.3.5 installed, but package-lock.json lists other content for it (integrity differs)');
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

  it('exits 1 and names a package whose folder is gone although node_modules/.package-lock.json still lists it', () => {
    writeCheckout(root, WANTED, WANTED);
    rmSync(path.join(root, 'node_modules', 'tsx'), { recursive: true });

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('tsx: 4.23.15 in package-lock.json, not installed');
  });

  it('reports a folder holding another version than node_modules/.package-lock.json says, as after a copy', () => {
    writeCheckout(root, WANTED, WANTED);
    writeFileSync(path.join(root, 'node_modules', 'vite', 'package.json'), JSON.stringify({ name: 'vite', version: '7.3.7' }));

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('vite: 7.3.7 installed, 8.3.5 in package-lock.json');
  });

  it('reports a node_modules/.package-lock.json that is not valid JSON as an install to redo, under --hook too', () => {
    writeCheckout(root, WANTED, WANTED);
    writeFileSync(path.join(root, 'node_modules', '.package-lock.json'), '{"packages": {');

    const result = runCheck(root);
    const hooked = runCheck(root, '--hook');

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('node_modules/.package-lock.json cannot be read');
    expect(result.stdout).toContain('Fix: npm ci');
    expect(hooked.status).toBe(0);
    expect(hooked.stdout).toBe(result.stdout);
  });

  it('reports a package-lock.json that is not valid JSON instead of throwing', () => {
    writeCheckout(root, WANTED, WANTED);
    writeFileSync(path.join(root, 'package-lock.json'), 'not json');

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('package-lock.json cannot be read');
  });

  it('starts the fix with a cd when run on a directory from another one, so it fixes the checkout it checked', () => {
    writeCheckout(root, WANTED, null);

    const result = spawnSync(process.execPath, [SCRIPT, root], { cwd: tmpdir(), encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`Fix: cd '${root}' && npm ci   # main checkout`);
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
    expect(result.stdout).toBe(runCheck(root).stdout);
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

  it('is npm ci in the main checkout, with the reason as a comment so the line can be pasted as it is', () => {
    expect(fixCommand(main, main)).toBe('npm ci   # main checkout');
  });

  it('changes to the checkout first when run from another directory', () => {
    expect(fixCommand(main, root)).toBe(`cd '${main}' && npm ci   # main checkout`);
  });

  it('is npm ci with HUSKY=0 in a linked worktree', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);

    expect(fixCommand(worktree, worktree)).toBe('HUSKY=0 npm ci --no-audit --no-fund   # linked worktree');
  });

  it('sends a worktree whose node_modules is a symlink into a checkout with the same lockfile to that checkout', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    mkdirSync(path.join(main, 'node_modules'));
    symlinkSync(path.join(main, 'node_modules'), path.join(worktree, 'node_modules'));
    writeFileSync(path.join(main, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));
    writeFileSync(path.join(worktree, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));

    expect(fixCommand(worktree, worktree)).toBe(
      `cd '${main}' && npm ci   # node_modules is a symlink into that checkout, which has the same package-lock.json; an npm ci here would rewrite it`,
    );
  });

  it('quotes a checkout path with a space or a quote in the cd it prints', () => {
    const shared = path.join(root, "it's shared");
    git(root, 'init', '--quiet', shared);
    mkdirSync(path.join(shared, 'node_modules'));
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    symlinkSync(path.join(shared, 'node_modules'), path.join(worktree, 'node_modules'));
    writeFileSync(path.join(shared, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));
    writeFileSync(path.join(worktree, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));

    expect(fixCommand(worktree, worktree)).toContain(`cd '${root}/it'\\''s shared' && npm ci`);
  });

  it('has a worktree whose node_modules symlink points at a checkout that is gone install its own, without throwing', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    writeFileSync(path.join(worktree, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));
    const gone = path.join(root, 'removed-checkout', 'node_modules');
    symlinkSync(gone, path.join(worktree, 'node_modules'));

    expect(fixCommand(worktree, worktree)).toBe(
      `rm node_modules && HUSKY=0 npm ci --no-audit --no-fund   # node_modules is a symlink to ${gone}, which no longer exists; rm removes only the symlink, then this checkout gets its own install`,
    );
    const result = runCheck(worktree);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('node_modules is missing');
    expect(result.stdout).toContain(`Fix: rm node_modules && HUSKY=0 npm ci --no-audit --no-fund`);
  });

  it('has a worktree whose lockfile differs from the symlinked checkout replace the symlink and install its own', () => {
    const worktree = path.join(root, 'worktree');
    git(main, 'worktree', 'add', '--quiet', '--detach', worktree);
    mkdirSync(path.join(main, 'node_modules'));
    symlinkSync(path.join(main, 'node_modules'), path.join(worktree, 'node_modules'));
    writeFileSync(path.join(main, 'package-lock.json'), JSON.stringify(lockfile(WANTED)));
    writeFileSync(path.join(worktree, 'package-lock.json'), JSON.stringify(lockfile({ ...WANTED, 'node_modules/vite': { version: '8.4.0' } })));

    expect(fixCommand(worktree, worktree)).toBe(
      `rm node_modules && HUSKY=0 npm ci --no-audit --no-fund   # node_modules is a symlink into ${main}, whose package-lock.json differs; rm removes only the symlink, then this checkout gets its own install`,
    );
    expect(fixCommand(worktree, root)).toBe(
      `cd '${worktree}' && rm node_modules && HUSKY=0 npm ci --no-audit --no-fund   # node_modules is a symlink into ${main}, whose package-lock.json differs; rm removes only the symlink, then this checkout gets its own install`,
    );
  });

  it('is npm ci outside a Git checkout', () => {
    expect(fixCommand(root, root)).toBe('npm ci   # main checkout');
  });
});
