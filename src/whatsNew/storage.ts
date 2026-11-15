/**
 * The What's new record: the Release the extension was first installed at, and the Last seen
 * Release. One `chrome.storage.local` key, apart from the Site settings, so resetting the
 * settings leaves it. This module is its only reader and writer.
 * Terms: CONTEXT.md, section "Releases".
 */

import { AsyncMutex } from '../utils/asyncMutex';

/** The `chrome.storage.local` key the What's new record is stored under */
export const WHATS_NEW_KEY = 'whatsNew';

export interface WhatsNewRecord {
  /** The Release of the first install; absent for an install older than What's new */
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

/** Shared by the popup, the side panel and the service worker */
const whatsNewLock = new AsyncMutex({ scope: 'WhatsNew' });

/** Writes one field over what storage holds, keeping the other one. */
const writeField = (field: keyof WhatsNewRecord, version: string): Promise<void> =>
  whatsNewLock.withLock(async () => {
    const record = await readWhatsNewRecord();
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { ...record, [field]: version } });
  });

/** Records the Release of a first install. The service worker calls it on `onInstalled` 'install'. */
export const recordInstall = (version: string): Promise<void> => writeField('installedVersion', version);

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
