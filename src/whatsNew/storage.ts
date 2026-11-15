/**
 * The What's new record: the Release of install (that of a first install, or the one an update
 * from an install older than What's new came from), and the Last seen Release. One `chrome.storage.local` key, apart from the Site settings, so Reset settings leaves
 * it; Clear All Data and the Reset Data of the error screen keep it too
 * (`clearStorageKeepingWhatsNew`). This module is its only reader and writer.
 * Terms: CONTEXT.md, section "Releases".
 */

import { AsyncMutex } from '../utils/asyncMutex';

/** The `chrome.storage.local` key the What's new record is stored under */
export const WHATS_NEW_KEY = 'whatsNew';

export interface WhatsNewRecord {
  /**
   * The Release of install: the one of a first install, or for an install older than What's new,
   * the Release it was updated from. Absent until the service worker records one.
   */
  readonly installedVersion?: string;
  /** The Last seen Release */
  readonly lastSeenVersion?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isVersion = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * The record a stored value stands for. A value that is not an object reads as {}; a field that
 * is not a non-empty string is left out. Never throws.
 */
export const parseWhatsNewRecord = (stored: unknown): WhatsNewRecord => {
  if (!isRecord(stored)) {
    return {};
  }
  return {
    ...(isVersion(stored.installedVersion) ? { installedVersion: stored.installedVersion } : {}),
    ...(isVersion(stored.lastSeenVersion) ? { lastSeenVersion: stored.lastSeenVersion } : {})
  };
};

/** The record as storage has it. Rejects only when storage cannot be read. */
export const readWhatsNewRecord = async (): Promise<WhatsNewRecord> => {
  const result = await chrome.storage.local.get([WHATS_NEW_KEY]);
  return parseWhatsNewRecord(result[WHATS_NEW_KEY]);
};

// Shared by the popup, the side panel and the service worker through the Web Locks API. Clear All
// Data takes it last, innermost, after the icon placement repairs lock (StorageManager.clearAllData),
// so a write waiting in another context lands before the clear or after it, never in the middle.
const whatsNewLock = new AsyncMutex({ scope: 'WhatsNew' });

/** Runs an operation while no context can change the What's new record */
export function withWhatsNewLock<T>(operation: () => Promise<T>): Promise<T> {
  return whatsNewLock.withLock(WHATS_NEW_KEY, operation);
}

/**
 * Empties `chrome.storage.local` but for the What's new record, which Clear All Data and the Reset
 * Data of the error screen leave, so What's new does not come back for a seen Release nor show on
 * a first install. Every other key is removed in one call; the record itself is never removed nor
 * rewritten, so no reader sees it missing and no failed write can lose it. Rejects, before
 * removing anything, when storage cannot be read. Takes no lock: the caller holds
 * `withWhatsNewLock`.
 */
export async function clearStorageKeepingWhatsNew(): Promise<void> {
  const stored = await chrome.storage.local.get(null);
  const others = Object.keys(stored).filter((key) => key !== WHATS_NEW_KEY);
  if (others.length > 0) {
    await chrome.storage.local.remove(others);
  }
}

/** Writes one field over what storage holds, keeping the other one. */
const writeField = (field: keyof WhatsNewRecord, version: string): Promise<void> =>
  withWhatsNewLock(async () => {
    const record = await readWhatsNewRecord();
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { ...record, [field]: version } });
  });

/** Records the Release of a first install. The service worker calls it on `onInstalled` 'install'. */
export const recordInstall = (version: string): Promise<void> => writeField('installedVersion', version);

/**
 * Records the Release an update came from as the Release of install, when the record has none:
 * an install older than What's new has no record, and its update must still show What's new. An
 * existing Release of install and the Last seen Release are kept. Writes nothing without a
 * previous version. The service worker calls it on `onInstalled` 'update'.
 *
 * @returns Whether it wrote the Release of install
 */
export const recordUpdateFrom = (previousVersion: string | undefined): Promise<boolean> => {
  if (!isVersion(previousVersion)) {
    return Promise.resolve(false);
  }
  return withWhatsNewLock(async () => {
    const record = await readWhatsNewRecord();
    if (record.installedVersion !== undefined) {
      return false;
    }
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { ...record, installedVersion: previousVersion } });
    return true;
  });
};

/**
 * Marks a Release as the Last seen Release: the only writer of `lastSeenVersion`. In Debug mode
 * it writes nothing, so a Debug session leaves the Last seen Release as it was.
 */
export const markReleaseSeen = async (version: string, { debugMode }: { debugMode: boolean }): Promise<void> => {
  if (debugMode) {
    return;
  }
  await writeField('lastSeenVersion', version);
};
