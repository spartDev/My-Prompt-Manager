/**
 * What Clear All Data (`StorageManager.clearAllData`) and the Reset Data of the error screen
 * (`src/components/ErrorBoundary.tsx`) keep: the What's new record and the Welcome record, so that
 * after a clear What's new does not come back for a seen Release nor show after a first install,
 * and the Welcome never comes back. Every other key of `chrome.storage.local` is removed.
 */

import { WELCOME_KEY, withWelcomeLock } from '../welcome/storage';
import { WHATS_NEW_KEY, withWhatsNewLock } from '../whatsNew/storage';

/** The keys a clear keeps */
export const KEPT_BY_CLEAR: readonly string[] = [WHATS_NEW_KEY, WELCOME_KEY];

/**
 * Runs an operation while no context can change a kept record: the What's new lock, then the
 * Welcome lock, the innermost locks of Clear All Data (docs/SERVICES_AND_HOOKS.md, locks)
 */
export function withKeptRecordLocks<T>(operation: () => Promise<T>): Promise<T> {
  return withWhatsNewLock(() => withWelcomeLock(operation));
}

/**
 * Empties `chrome.storage.local` but for the kept records. Every other key is removed in one call;
 * a kept record is never removed nor rewritten, so no reader sees it missing and no failed write
 * can lose it. Rejects, before removing anything, when storage cannot be read. Takes no lock: the
 * caller holds `withKeptRecordLocks`.
 */
export async function clearStorageKeepingRecords(): Promise<void> {
  const stored = await chrome.storage.local.get(null);
  const others = Object.keys(stored).filter((key) => !KEPT_BY_CLEAR.includes(key));
  if (others.length > 0) {
    await chrome.storage.local.remove(others);
  }
}
