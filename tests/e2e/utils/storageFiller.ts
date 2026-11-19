/**
 * A refused add for real: chrome.storage.local filled past the 98% the extension keeps free
 * (checkQuotaAvailability, src/utils/storageQuota.ts) with a key of the tests', so the built
 * extension's own quota check refuses the Packs. A first install has no such store; it is the honest
 * way to make the add fail without changing the build. The storage fixture's reset removes the key.
 */
import type { BrowserContext, Worker } from '@playwright/test';

import { waitForBackgroundTarget } from '../fixtures/extension';

/** The key that fills the store; the extension never reads it */
export const FILLER_KEY = 'e2eFiller';

/** The extension's service worker, where chrome.storage.local is filled and emptied */
export const backgroundWorker = async (context: BrowserContext): Promise<Worker> =>
  // The background of a Manifest V3 extension is its service worker, as the storage fixture casts it
  (await waitForBackgroundTarget(context)) as Worker;

/** Fills the store to 98.5% of its quota; returns the share in use */
export const fillStorage = (worker: Worker): Promise<number> =>
  worker.evaluate(async (key) => {
    const quota = chrome.storage.local.QUOTA_BYTES;
    const used = await chrome.storage.local.getBytesInUse();
    // 98.5% of the quota in use; the key and the quotes of its JSON count too
    const length = Math.floor(quota * 0.985) - used - key.length - 2;
    await chrome.storage.local.set({ [key]: 'x'.repeat(length) });
    return (await chrome.storage.local.getBytesInUse()) / quota;
  }, FILLER_KEY);

/** Room again: the filler removed */
export const emptyFiller = (worker: Worker): Promise<void> =>
  worker.evaluate((key) => chrome.storage.local.remove(key), FILLER_KEY);
