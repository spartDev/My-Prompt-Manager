/**
 * The test-only builds the What's new e2e load (My-Prompt-Manager-d1g.10): one at a Release that has
 * Release notes, one at a Release that has none.
 *
 * Whether What's new shows depends on the installed Release: the Release notes registry has notes for
 * some Releases only. dist/ is at the repository's manifest version, which has notes at one bump and
 * none at the next, so the specs that need one or the other do not run on dist/. The global setup
 * copies dist/ twice and sets each copy's manifest version; only that one manifest field differs
 * from dist/:
 *
 * - dist-e2e-whats-new/ at 2.0.0, which has Release notes, as after the update to 2.0.0. dist/ is at
 *   2.0.0 too while 2.0.0 is the repository's version; the copy keeps these specs on a Release with
 *   notes after the next bump;
 * - dist-e2e-without-notes/ at 1.9.0, the Release before 2.0.0, which has none: there an update shows
 *   nothing (My-Prompt-Manager-totf).
 *
 * Each build checks the registry first, so a registry that no longer fits a version fails the global
 * setup, not the specs that count on it.
 */
import path from 'node:path';

import { RELEASE_NOTES } from '../../../src/whatsNew/releaseNotes';
import { copyDistWithManifest } from './dist-copy';

/** The Release the first copy is installed at: the one the registry has Release notes for */
export const WHATS_NEW_UPDATE_VERSION = '2.0.0';

export const WHATS_NEW_UPDATE_EXTENSION_PATH = path.resolve(process.cwd(), 'dist-e2e-whats-new');

/** The Release the second copy is installed at: 1.9.0, which the registry has no Release notes for */
export const RELEASE_WITHOUT_NOTES = '1.9.0';

export const RELEASE_WITHOUT_NOTES_EXTENSION_PATH = path.resolve(process.cwd(), 'dist-e2e-without-notes');

const hasReleaseNotes = (version: string): boolean => RELEASE_NOTES.some((notes) => notes.version === version);

/** Copies the build in `dist` to WHATS_NEW_UPDATE_EXTENSION_PATH at version WHATS_NEW_UPDATE_VERSION */
export function buildWhatsNewUpdateExtension(dist: string): void {
  if (!hasReleaseNotes(WHATS_NEW_UPDATE_VERSION)) {
    throw new Error(`The What's new e2e installs ${WHATS_NEW_UPDATE_VERSION} as a Release that has Release notes, but src/whatsNew/releaseNotes.ts has none for it`);
  }
  copyDistWithManifest(dist, WHATS_NEW_UPDATE_EXTENSION_PATH, (manifest) => ({ ...manifest, version: WHATS_NEW_UPDATE_VERSION }));
}

/** Copies the build in `dist` to RELEASE_WITHOUT_NOTES_EXTENSION_PATH at version RELEASE_WITHOUT_NOTES */
export function buildReleaseWithoutNotesExtension(dist: string): void {
  if (hasReleaseNotes(RELEASE_WITHOUT_NOTES)) {
    throw new Error(`The What's new e2e installs ${RELEASE_WITHOUT_NOTES} as a Release without notes, but src/whatsNew/releaseNotes.ts has notes for it`);
  }
  copyDistWithManifest(dist, RELEASE_WITHOUT_NOTES_EXTENSION_PATH, (manifest) => ({ ...manifest, version: RELEASE_WITHOUT_NOTES }));
}
