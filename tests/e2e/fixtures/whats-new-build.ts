/**
 * The test-only build the What's new e2e loads for the update case (My-Prompt-Manager-d1g.10).
 *
 * The repository's manifest is 1.9.0 and the Release notes registry has notes for 2.0.0 only, so
 * the build in dist/ never shows What's new in normal mode. The global setup copies dist/ to
 * dist-e2e-whats-new/ and sets the copy's manifest version to 2.0.0: there the installed Release
 * has Release notes, as after the update to 2.0.0. Only that one manifest field differs from dist/.
 */
import path from 'node:path';

import { copyDistWithManifest } from './dist-copy';

/** The Release the copy is installed at: the one the registry has Release notes for */
export const WHATS_NEW_UPDATE_VERSION = '2.0.0';

export const WHATS_NEW_UPDATE_EXTENSION_PATH = path.resolve(process.cwd(), 'dist-e2e-whats-new');

/** Copies the build in `dist` to WHATS_NEW_UPDATE_EXTENSION_PATH at version WHATS_NEW_UPDATE_VERSION */
export function buildWhatsNewUpdateExtension(dist: string): void {
  copyDistWithManifest(dist, WHATS_NEW_UPDATE_EXTENSION_PATH, (manifest) => ({ ...manifest, version: WHATS_NEW_UPDATE_VERSION }));
}
