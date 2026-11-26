/**
 * The lock of the usage history (`usageHistory`, owned by `src/services/UsageTracker.ts`), apart
 * from the tracker so Clear All Data (`StorageManager.clearAllData`) can take it without loading the
 * tracker.
 */

import { USAGE_STORAGE_KEY } from '../types';
import { AsyncMutex } from '../utils/asyncMutex';

// Shared by every context (popup, side panel, service worker) through the Web Locks API, so a
// removal of the older insertions in the service worker cannot write back a history cleared
// meanwhile. Clear All Data takes it after the settings lock and before the Site settings lock, so
// an insertion recorded in another context lands wholly before the clear, and is cleared with it,
// or after it, on the emptied history.
const usageHistoryLock = new AsyncMutex({ scope: 'UsageTracker' });

/** Runs an operation while no context can change the usage history */
export function withUsageHistoryLock<T>(operation: () => Promise<T>): Promise<T> {
  return usageHistoryLock.withLock(USAGE_STORAGE_KEY, operation);
}
