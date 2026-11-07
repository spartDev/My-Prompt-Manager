/**
 * Checks that node_modules is the install package-lock.json describes, so a stale install is found before it costs
 * a session. An agent worktree keeps the node_modules it was created with while main moves on: after PR #483 took
 * Vite from 7 to 8, a stale Vite 7 built a dist/ with one page and ~150 e2e tests failed, and a missing tsx killed a
 * script test with "exit code null".
 *
 * npm writes node_modules/.package-lock.json from the tree it installed, so the check compares every entry of
 * package-lock.json "packages" with it: a version that differs, a package that is not installed, and one installed
 * that the lockfile does not list. An entry counts as installed only while its folder still holds a package.json,
 * since npm leaves that file as it was when a folder is deleted by hand or an install is cut short. An optional package built for another platform is expected to be absent, since
 * npm skips it (@biomejs/cli-linux-x64 on macOS); one built for this platform is not, since the toolchain needs it
 * (@rolldown/binding-darwin-arm64 on an Apple-silicon Mac).
 *
 * Runs as the npm `pretest` script, so `npm test` stops at once on a stale install, and as a Claude Code SessionStart
 * hook (.claude/settings.json). Prints nothing when the two agree. Otherwise it prints the packages that differ and
 * the fix, and exits 1; with --hook it exits 0 even then, because Claude Code adds a SessionStart hook's stdout to the
 * context only when the hook exits 0.
 *
 * Usage: node scripts/check-deps.mjs [--hook] [dir]   (dir defaults to the repository root)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** How many differing packages the report lists before it counts the rest, to keep the hook output short. */
const MAX_LISTED = 20;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** `vite` for `node_modules/vite`; `jsdom/node_modules/lru-cache` for a nested entry. */
const packageName = (key) => key.replace(/^node_modules\//, '');

/** `node_modules/jsdom` for `node_modules/jsdom/node_modules/lru-cache`; '' for a top-level entry. */
const parentKey = (key) => {
  const index = key.lastIndexOf('/node_modules/');
  return index === -1 ? '' : key.slice(0, index);
};

/** The libc of a Linux host: glibc when Node reports a runtime version for it, else musl. */
const currentLibc = () => {
  try {
    return process.report?.getReport?.()?.header?.glibcVersionRuntime ? 'glibc' : 'musl';
  } catch {
    return undefined;
  }
};

/** The platform npm installs for, as package.json "os", "cpu" and "libc" name it. */
export const currentPlatform = () => ({
  os: process.platform,
  cpu: process.arch,
  libc: process.platform === 'linux' ? currentLibc() : undefined,
});

/** True when a package.json "os", "cpu" or "libc" list admits `actual`: any value, or a listed one, and no `!actual`. */
const listAdmits = (list, actual) => {
  if (!Array.isArray(list) || list.length === 0 || actual === undefined) {
    return true;
  }
  if (list.includes(`!${actual}`)) {
    return false;
  }
  const named = list.filter((value) => !value.startsWith('!'));
  return named.length === 0 || named.includes('any') || named.includes(actual);
};

/** True when a lockfile entry is built for `platform`, by its "os", "cpu" and "libc" lists. */
export const builtForPlatform = (entry, platform) =>
  listAdmits(entry.os, platform.os) && listAdmits(entry.cpu, platform.cpu) && listAdmits(entry.libc, platform.libc);

/**
 * True when npm is expected to leave the lockfile entry at `key` out of an install for `platform`: it is an optional
 * package built for another platform, or it sits under one (the bundled dependencies of a wasm32 build).
 */
const expectedAbsent = (key, wanted, platform) => {
  for (let ancestor = key; ancestor !== ''; ancestor = parentKey(ancestor)) {
    const entry = wanted[ancestor];
    if (entry?.optional && !builtForPlatform(entry, platform)) {
      return true;
    }
  }
  return false;
};

/**
 * The differences between the packages package-lock.json lists and the ones node_modules/.package-lock.json says
 * npm installed, as { name, expected, installed }: the lockfile's version and the installed one, either undefined
 * for a package that is not installed or not in the lockfile. An optional package built for another platform is
 * expected to be absent and is not a difference; one built for `platform` is.
 */
export function compareLockfiles(lockfile, installed, platform = currentPlatform()) {
  const wanted = lockfile.packages ?? {};
  const present = installed.packages ?? {};
  const differences = [];
  for (const [key, entry] of Object.entries(wanted)) {
    if (key === '') {
      continue; // the project itself, which the installed tree does not list
    }
    const actual = present[key];
    if (actual === undefined) {
      if (!expectedAbsent(key, wanted, platform)) {
        differences.push({ name: packageName(key), expected: entry.version, installed: undefined });
      }
    } else if (actual.version !== entry.version) {
      differences.push({ name: packageName(key), expected: entry.version, installed: actual.version });
    }
  }
  for (const [key, entry] of Object.entries(present)) {
    if (key !== '' && !(key in wanted)) {
      differences.push({ name: packageName(key), expected: undefined, installed: entry.version });
    }
  }
  return differences;
}

const describeDifference = ({ name, expected, installed }) => {
  if (installed === undefined) {
    return `${name}: ${expected} in package-lock.json, not installed`;
  }
  if (expected === undefined) {
    return `${name}: ${installed} installed, not in package-lock.json`;
  }
  return `${name}: ${installed} installed, ${expected} in package-lock.json`;
};

/** The report for a stale install: the headline, up to MAX_LISTED differences, and the fix. */
export function report(differences, fix) {
  const count = differences.length;
  const lines = differences.slice(0, MAX_LISTED).map((difference) => `  ${describeDifference(difference)}`);
  if (count > MAX_LISTED) {
    lines.push(`  … and ${count - MAX_LISTED} more`);
  }
  return [
    `Stale install: node_modules differs from package-lock.json in ${count} package${count === 1 ? '' : 's'} (scripts/check-deps.mjs).`,
    ...lines,
    `Fix: ${fix}`,
  ].join('\n');
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const isSymlink = (file) => {
  try {
    return lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
};

/** True when `root` is a linked Git worktree: its git dir differs from the common git dir of the repository. */
const isLinkedWorktree = (root) => {
  try {
    const [gitDir, commonDir] = git(root, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir').split('\n');
    return realpathSync(gitDir) !== realpathSync(commonDir);
  } catch {
    return false; // not a Git checkout
  }
};

/** `value` as one word for sh: single-quoted, with an embedded single quote closed, escaped and reopened. */
const shellQuote = (value) => `'${value.replace(/'/g, "'\\''")}'`;

/** The fix as one sh command that can be pasted as it is, with its reason as a trailing comment. */
const withReason = (command, reason) => `${command}   # ${reason}`;

const describeError = (error) => (error instanceof Error ? error.message : String(error));

/** True when the two checkouts have the same package-lock.json, byte for byte. */
const sameLockfile = (a, b) => {
  try {
    return readFileSync(path.join(a, 'package-lock.json'), 'utf8') === readFileSync(path.join(b, 'package-lock.json'), 'utf8');
  } catch {
    return false;
  }
};

/**
 * The command that brings node_modules in line with package-lock.json for the checkout at `root`. A linked worktree
 * runs npm ci with HUSKY=0, which keeps the core.hooksPath every checkout shares. A worktree whose node_modules is a
 * symlink into another checkout must not run npm ci through it, since that would rewrite the other checkout's
 * node_modules: when the two checkouts have the same package-lock.json, npm ci in that checkout fixes both; when
 * they differ, or the symlink's target is gone, the worktree needs an install of its own, so the symlink goes first
 * (rm removes the link, not the target) and npm ci runs here.
 */
export function fixCommand(root) {
  const modules = path.join(root, 'node_modules');
  const linked = isLinkedWorktree(root);
  const install = linked ? 'HUSKY=0 npm ci --no-audit --no-fund' : 'npm ci';
  if (isSymlink(modules)) {
    let checkout;
    try {
      checkout = path.dirname(realpathSync(modules));
    } catch {
      return withReason(
        `rm node_modules && ${install}`,
        `node_modules is a symlink to ${readlinkSync(modules)}, which no longer exists; rm removes only the symlink, then this checkout gets its own install`,
      );
    }
    if (sameLockfile(root, checkout)) {
      return withReason(
        `cd ${shellQuote(checkout)} && npm ci`,
        'node_modules is a symlink into that checkout, which has the same package-lock.json; an npm ci here would rewrite it',
      );
    }
    return withReason(
      `rm node_modules && ${install}`,
      `node_modules is a symlink into ${checkout}, whose package-lock.json differs; rm removes only the symlink, then this checkout gets its own install`,
    );
  }
  return withReason(install, linked ? 'linked worktree' : 'main checkout');
}

/** The report for the checkout at `root`, or an empty string when node_modules matches package-lock.json. */
export function check(root) {
  const lockfilePath = path.join(root, 'package-lock.json');
  const modules = path.join(root, 'node_modules');
  const installedPath = path.join(modules, '.package-lock.json');
  if (!existsSync(lockfilePath)) {
    return `package-lock.json is missing in ${root}, so the install cannot be checked (scripts/check-deps.mjs).`;
  }
  if (!existsSync(modules)) {
    return `node_modules is missing in ${root} (scripts/check-deps.mjs).\nFix: ${fixCommand(root)}`;
  }
  if (!existsSync(installedPath)) {
    return `node_modules/.package-lock.json is missing in ${root}, so the install cannot be checked; npm writes it on every install (scripts/check-deps.mjs).\nFix: ${fixCommand(root)}`;
  }
  let lockfile;
  try {
    lockfile = readJson(lockfilePath);
  } catch (error) {
    return `package-lock.json cannot be read in ${root} (${describeError(error)}), so the install cannot be checked (scripts/check-deps.mjs).`;
  }
  let installed;
  try {
    installed = readJson(installedPath);
  } catch (error) {
    return `node_modules/.package-lock.json cannot be read in ${root} (${describeError(error)}); an install cut short leaves it so (scripts/check-deps.mjs).\nFix: ${fixCommand(root)}`;
  }
  installed.packages = Object.fromEntries(
    Object.entries(installed.packages ?? {}).filter(([key]) => existsSync(path.join(root, key, 'package.json'))),
  );
  const differences = compareLockfiles(lockfile, installed);
  return differences.length === 0 ? '' : report(differences, fixCommand(root));
}

function main(args) {
  const hook = args.includes('--hook');
  const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? ROOT);
  let message;
  try {
    message = check(root);
  } catch (error) {
    // Whatever else fails (a folder that cannot be read, say), the session gets one line rather than a stack trace.
    message = `node_modules in ${root} cannot be checked: ${describeError(error)} (scripts/check-deps.mjs).`;
  }
  if (message === '') {
    return 0;
  }
  process.stdout.write(`${message}\n`);
  return hook ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
