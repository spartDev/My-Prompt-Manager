/**
 * Which composer fixture the chain tests read for a Platform. `npm run composers:capture` runs
 * them on what it just captured: the folder it wrote to and the Platforms it captured this run,
 * passed in the environment. Any other Platform, or a file left in that folder by an earlier run,
 * is read from the committed fixtures.
 */

import path from 'node:path';

/** The folder the capture wrote to (its --out) */
export const CAPTURED_DIR_ENV = 'COMPOSER_FIXTURES';
/** The Platforms the capture wrote this run, comma-separated */
export const CAPTURED_IDS_ENV = 'COMPOSER_CAPTURED';

export function composerFixturePath(platformId: string, committedDir: string, env: Readonly<Record<string, string | undefined>>): string {
  const dir = env[CAPTURED_DIR_ENV];
  const captured = (env[CAPTURED_IDS_ENV] ?? '').split(',').map((id) => id.trim());
  return dir && captured.includes(platformId)
    ? path.resolve(dir, `${platformId}.html`)
    : path.resolve(committedDir, `${platformId}.html`);
}
