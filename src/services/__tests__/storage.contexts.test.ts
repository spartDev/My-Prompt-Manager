import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeLockManager, installNavigatorLocks } from '../../test/utils/FakeLockManager';
import { DEFAULT_CATEGORY } from '../../types';
import { StorageManager } from '../storage';

/**
 * The popup, the side panel and the service worker each run StorageManager in their own JS
 * context over the one chrome.storage. Their locks must be shared (the Web Locks API), or a
 * write that reads, decides and writes (the upgrade pass, a usage count) overwrites a write
 * made in between from another context. A context here is a StorageManager instance of its
 * own, over the shared chrome.storage fake and a shared fake lock manager.
 */
describe('StorageManager across contexts', () => {
  let uninstall: () => void;

  /** A StorageManager of its own context: its own memory, the shared storage and the shared locks. */
  const context = (): StorageManager => Reflect.construct(StorageManager, []);

  const prompt = (id: string, fields: Record<string, unknown> = {}): Record<string, unknown> => ({
    id,
    title: `Title ${id}`,
    content: 'Body',
    category: DEFAULT_CATEGORY,
    createdAt: 1,
    updatedAt: 2,
    usageCount: 0,
    lastUsedAt: 1,
    ...fields
  });

  const storedPrompts = async (): Promise<unknown> => (await chrome.storage.local.get('prompts')).prompts;

  /** Makes the first chrome.storage read of `key` slow, so the other context can write in between. */
  const slowRead = (key: string): void => {
    const read = vi.mocked(chrome.storage.local.get).getMockImplementation() as unknown as (
      keys: unknown
    ) => Promise<Record<string, unknown>>;
    let slowed = false;
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const result = await read(keys);
      if (!slowed && String(keys) === key) {
        slowed = true;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return result;
    });
  };

  beforeEach(async () => {
    uninstall = installNavigatorLocks(new FakeLockManager());
    await chrome.storage.local.set({
      prompts: [],
      categories: [{ id: 'default', name: DEFAULT_CATEGORY }],
      settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
    });
  });

  afterEach(() => {
    uninstall();
  });

  it('the upgrade pass in the service worker cannot overwrite a Prompt the popup saves meanwhile', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1', { title: 'Ti\u{200B}tle' })] });
    const worker = context();
    const popup = context();
    slowRead('settings'); // the worker's last read before its write

    const [, saved] = await Promise.all([
      worker.upgradeStoredData(),
      popup.savePrompt({ title: 'Saved meanwhile', content: 'Body', category: DEFAULT_CATEGORY })
    ]);

    expect(await storedPrompts()).toEqual([prompt('p1', { title: 'Title' }), saved]);
  });

  it('a pin toggled in the popup and a use counted by the service worker are both kept', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1')] });
    const worker = context();
    const popup = context();
    slowRead('prompts'); // the first read, whichever context makes it, is slow

    await Promise.all([worker.incrementUsageCount('p1'), popup.togglePinned('p1')]);

    expect(await storedPrompts()).toEqual([
      expect.objectContaining({ id: 'p1', pinned: true, usageCount: 1, updatedAt: 2 })
    ]);
  });

  it('asks the other contexts for the Prompt and Category locks, but not for the settings lock', async () => {
    // A settings toggle is the one write a user triggers by hand and may close the page right after,
    // so it must not wait for a lock round trip to the other contexts
    uninstall();
    const locks = new FakeLockManager();
    uninstall = installNavigatorLocks(locks);
    const popup = context();

    await popup.savePrompt({ title: 'Saved', content: 'Body', category: DEFAULT_CATEGORY });
    await popup.updateSettings({ sortOrder: 'title' });

    expect(locks.log.filter((entry) => entry.startsWith('acquire'))).toEqual(['acquire StorageManager:prompts']);
    expect((await chrome.storage.local.get('settings')).settings).toMatchObject({ sortOrder: 'title' });
  });

  it('a usage count in the service worker cannot overwrite an edit the popup makes meanwhile', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1', { title: 'Old' })] });
    const worker = context();
    const popup = context();
    slowRead('prompts'); // the worker reads first

    await Promise.all([worker.incrementUsageCount('p1'), popup.updatePrompt('p1', { title: 'New' })]);

    expect(await storedPrompts()).toMatchObject([{ id: 'p1', title: 'New', usageCount: 1 }]);
  });
});
