/**
 * Checks that node_modules is the install package-lock.json describes, so a stale install is found before it costs
 * a session. An agent worktree keeps the node_modules it was created with while main moves on: after PR #483 took
 * Vite from 7 to 8, a stale Vite 7 built a dist/ with one page and ~150 e2e tests failed, and a missing tsx killed a
 * script test with "exit code null".
 *
 * npm writes node_modules/.package-lock.json from the tree it installed, so the check compares every entry of
 * package-lock.json "packages" with it: a version that differs, a package that is not installed, and one installed
 * that the lockfile does not list. An optional package that is absent is not a difference, since npm skips the ones
 * built for other platforms (@biomejs/cli-linux-x64 on macOS).
 *
 * Runs as the npm `pretest` script, so `npm test` stops at once on a stale install, and as a Claude Code SessionStart
 * hook (.claude/settings.json). Prints nothing when the two agree. Otherwise it prints the packages that differ and
 * the fix, and exits 1; with --hook it exits 0 even then, because Claude Code adds a SessionStart hook's stdout to the
 * context only when the hook exits 0.
 *
 * Usage: node scripts/check-deps.mjs [--hook] [dir]   (dir defaults to the repository root)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** How many differing packages the report lists before it counts the rest, to keep the hook output short. */
const MAX_LISTED = 20;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** `vite` for `node_modules/vite`; `jsdom/node_modules/lru-cache` for a nested entry. */
const packageName = (key) => key.replace(/^node_modules\//, '');

/**
 * The differences between the packages package-lock.json lists and the ones node_modules/.package-lock.json says
 * npm installed, as { name, expected, installed }: the lockfile's version and the installed one, either undefined
 * for a package that is not installed or not in the lockfile. An absent optional package is not a difference.
 */
export function compareLockfiles(lockfile, installed) {
  const wanted = lockfile.packages ?? {};
  const present = installed.packages ?? {};
  const differences = [];
  for (const [key, entry] of Object.entries(wanted)) {
    if (key === '') {
      continue; // the project itself, which the installed tree does not list
    }
    const actual = present[key];
    if (actual === undefined) {
      if (!entry.optional) {
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

/**
 * The command that brings node_modules in line with package-lock.json for the checkout at `root`. A linked worktree
 * runs npm ci with HUSKY=0, which keeps the core.hooksPath every checkout shares. A worktree whose node_modules is a
 * symlink into another checkout must not run npm ci at all: it would rewrite that checkout's node_modules.
 */
export function fixCommand(root) {
  const modules = path.join(root, 'node_modules');
  if (isSymlink(modules)) {
    const checkout = path.dirname(realpathSync(modules));
    return `cd ${checkout} && npm ci (node_modules is a symlink into that checkout; an npm ci here would rewrite it)`;
  }
  try {
    const [gitDir, commonDir] = git(root, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir').split('\n');
    if (realpathSync(gitDir) !== realpathSync(commonDir)) {
      return 'HUSKY=0 npm ci --no-audit --no-fund (linked worktree)';
    }
  } catch {
    // Not a Git checkout: the main-checkout command applies.
  }
  return 'npm ci (main checkout)';
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
  const differences = compareLockfiles(readJson(lockfilePath), readJson(installedPath));
  return differences.length === 0 ? '' : report(differences, fixCommand(root));
}

function main(args) {
  const hook = args.includes('--hook');
  const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? ROOT);
  const message = check(root);
  if (message === '') {
    return 0;
  }
  process.stdout.write(`${message}\n`);
  return hook ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
