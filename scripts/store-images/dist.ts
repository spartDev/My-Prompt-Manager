/**
 * Whether dist/ holds a build the store images can be made from: built, at the Release of
 * package.json, and not older than the sources it was built from. The script never builds.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** What a build is made from: a change to any of them after the build makes it stale */
export const BUILD_SOURCES = ['src', 'public', 'manifest.json', 'vite.config.ts', 'package.json'] as const;

/** The newest modification time under `entry` (a file or a folder), 0 when it does not exist */
const newestUnder = (entry: string): { time: number; file: string } => {
  if (!existsSync(entry)) {
    return { time: 0, file: entry };
  }
  const stats = statSync(entry);
  if (!stats.isDirectory()) {
    return { time: stats.mtimeMs, file: entry };
  }
  let newest = { time: 0, file: entry };
  for (const name of readdirSync(entry)) {
    const candidate = newestUnder(path.join(entry, name));
    if (candidate.time > newest.time) {
      newest = candidate;
    }
  }
  return newest;
};

const versionIn = (file: string): string | undefined => {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return typeof parsed === 'object' && parsed !== null && 'version' in parsed && typeof parsed.version === 'string' ? parsed.version : undefined;
};

/**
 * Why the build in `dist` cannot be used, or null when it can. `root` is the repository: its
 * package.json gives the Release, and BUILD_SOURCES under it must not be newer than the build.
 */
export function distProblem(root: string, dist: string): string | null {
  const manifest = path.join(dist, 'manifest.json');
  if (!existsSync(manifest)) {
    return `No build in ${dist}: run npm run build first.`;
  }
  const release = versionIn(path.join(root, 'package.json'));
  const built = versionIn(manifest);
  if (built !== release) {
    return `The build in ${dist} is ${built ?? 'of no version'}, package.json is ${release ?? 'of no version'}: run npm run build first.`;
  }
  const builtAt = statSync(manifest).mtimeMs;
  const newest = BUILD_SOURCES.map((entry) => newestUnder(path.join(root, entry))).reduce((a, b) => (b.time > a.time ? b : a));
  if (newest.time > builtAt) {
    return `The build in ${dist} is older than ${path.relative(root, newest.file)}: run npm run build first.`;
  }
  return null;
}
