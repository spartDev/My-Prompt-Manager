import type { ErrorType } from '../types';

export interface StorageAvailabilityOptions {
  maxAttempts?: number;
  delayMs?: number;
}

const DEFAULT_OPTIONS: Required<StorageAvailabilityOptions> = {
  maxAttempts: 50,
  delayMs: 100
};

/**
 * Wait for chrome.storage.local to be available.
 * In some contexts (e.g., analytics.html in a new tab), the chrome API
 * may not be immediately available when the page first loads.
 *
 * @throws Error with type STORAGE_UNAVAILABLE if storage doesn't become available
 */
export async function ensureStorageAvailable(
  options: StorageAvailabilityOptions = {}
): Promise<void> {
  const { maxAttempts, delayMs } = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  const error = new Error(
    'Chrome storage API is not available. Please ensure you are running within a Chrome extension context.'
  );
  (error as Error & { type: ErrorType; details: unknown }).type = 'STORAGE_UNAVAILABLE';
  (error as Error & { type: ErrorType; details: unknown }).details = { maxAttempts, delayMs };
  throw error;
}
