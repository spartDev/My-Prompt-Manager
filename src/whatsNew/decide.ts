import { newestReleaseNotes } from './releaseNotes';
import type { ReleaseNotes } from './types';

/** What the What's new decision depends on. Terms: CONTEXT.md, section "Releases". */
export interface WhatsNewInputs {
  /** The installed Release, the manifest version */
  readonly currentVersion: string;
  /** The Last seen Release, absent until the user first closes What's new */
  readonly lastSeenVersion: string | undefined;
  /** Every Release that has Release notes */
  readonly releaseNotes: readonly ReleaseNotes[];
  /** The installed Release is the one the extension was first installed at (`isFirstInstall`) */
  readonly isFirstInstall: boolean;
  readonly debugMode: boolean;
}

/**
 * Whether an opening counts as one after a first install. A record with no Release of install
 * counts as one too: on a first install the popup can open before the service worker recorded it,
 * and showing nothing then is the safe failure (an update records where it came from, so What's
 * new shows at a later opening). Pure.
 *
 * @param installedVersion - The Release of install the What's new record holds, if any
 * @param currentVersion - The installed Release, the manifest version
 */
export const isFirstInstall = (installedVersion: string | undefined, currentVersion: string): boolean =>
  installedVersion === undefined || installedVersion === currentVersion;

/** The Release notes of a version, when that Release has at least one item. */
const notesOf = (registry: readonly ReleaseNotes[], version: string): ReleaseNotes | undefined =>
  registry.find((notes) => notes.version === version && notes.items.length > 0);

/**
 * The Release notes What's new shows, or null when it shows nothing. Pure.
 *
 * Normal: the installed Release's notes, when it has some, is not the Last seen Release (plain
 * equality, no version order: after skipped Releases only the installed one's notes show) and
 * is not a first install.
 * Debug mode: always the installed Release's notes, else those of the newest Release that has
 * notes; null only when no Release has any.
 */
export const decideWhatsNew = ({
  currentVersion,
  lastSeenVersion,
  releaseNotes,
  isFirstInstall,
  debugMode
}: WhatsNewInputs): ReleaseNotes | null => {
  const current = notesOf(releaseNotes, currentVersion);

  if (debugMode) {
    return current ?? newestReleaseNotes(releaseNotes) ?? null;
  }

  if (current === undefined || lastSeenVersion === currentVersion || isFirstInstall) {
    return null;
  }
  return current;
};
