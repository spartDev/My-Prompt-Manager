import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeLockManager, installNavigatorLocks } from '../../test/utils/FakeLockManager';
import { DEFAULT_CATEGORY, USAGE_STORAGE_KEY, type UsageEvent } from '../../types';
import { StorageManager } from '../storage';
import { UsageTracker } from '../UsageTracker';

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

  /**
   * Makes the next removal of keys slow (Clear All Data removes every key but the What's new
   * record); resolves when it starts, so the other context can act while it runs.
   */
  const slowClear = (): Promise<void> => {
    const remove = vi.mocked(chrome.storage.local.remove).getMockImplementation() as unknown as (
      keys: string | string[]
    ) => Promise<void>;
    return new Promise((started) => {
      vi.mocked(chrome.storage.local.remove).mockImplementationOnce(async (keys) => {
        started();
        await new Promise((resolve) => setTimeout(resolve, 20));
        return remove(keys as string | string[]);
      });
    });
  };

  /** The UsageTracker of a context of its own: the service worker records every insertion */
  const usageContext = (): UsageTracker => Reflect.construct(UsageTracker, []);

  const insertion = (promptId: string): UsageEvent => ({
    promptId,
    timestamp: Date.now() - 1000,
    platform: 'claude',
    categoryId: null
  });

  const storedUsage = async (): Promise<unknown> => (await chrome.storage.local.get(USAGE_STORAGE_KEY))[USAGE_STORAGE_KEY];

  /** Holds the next read of `key` once it has read storage, until `resume`; `reached` resolves when it is held. */
  const pauseRead = (key: string): { reached: Promise<void>; resume: () => void } => {
    const read = vi.mocked(chrome.storage.local.get).getMockImplementation() as unknown as (
      keys: unknown
    ) => Promise<Record<string, unknown>>;
    let resume!: () => void;
    let held!: () => void;
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    const reached = new Promise<void>((resolve) => { held = resolve; });
    let paused = false;
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const result = await read(keys);
      if (!paused && String(keys) === key) {
        paused = true;
        held();
        await gate;
      }
      return result;
    });
    return { reached, resume };
  };

  /** Lets every queued microtask and timer of the other contexts run */
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

  /** Rejects when the operations are still waiting after `ms`: one of them waits for a lock that is never released */
  const settledWithin = async <T,>(ms: number, operations: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stuck = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`still waiting after ${ms} ms: a lock is never released`)), ms);
    });
    try {
      return await Promise.race([operations, stuck]);
    } finally {
      clearTimeout(timer);
    }
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

  it('a Category list read in the popup, with no default Category stored, cannot overwrite a Category the service worker saves meanwhile', async () => {
    // The default Category is absent (a fresh store, or a dirty default name): the read creates it
    await chrome.storage.local.set({ categories: [{ id: 'work', name: 'Work' }] });
    const worker = context();
    const popup = context();
    slowRead('categories'); // the popup's read, made first, returns after the worker's write

    const [, saved] = await Promise.all([popup.getCategories(), worker.saveCategory({ name: 'Saved meanwhile' })]);

    const stored = (await chrome.storage.local.get('categories')).categories as { id: string; name: string }[];
    expect(stored.map((category) => category.name)).toEqual([DEFAULT_CATEGORY, 'Work', 'Saved meanwhile']);
    expect(stored).toContainEqual(saved);
  });

  // My-Prompt-Manager-ou48: the read skips the entries that are not a Category, but the default
  // Category it writes goes before the whole stored list, read again under the lock
  it('a Category list read in the popup over malformed entries, with no default Category stored, cannot drop a Category the service worker adds meanwhile, nor a malformed entry', async () => {
    const work = { id: 'work', name: 'Work', color: '#DB2777' };
    const nameless = { id: 'nameless' };
    await chrome.storage.local.set({ categories: [null, work, nameless] });
    const worker = context();
    const popup = context();
    slowRead('categories'); // the popup's read, made first, returns after the worker's write

    const [read] = await Promise.all([
      popup.getCategories(),
      worker.addPacks([{ id: 'product', name: 'Product', color: '#2563EB', defaultSelected: true, prompts: [{ title: 'User story', content: 'Write a user story.' }] }])
    ]);

    const stored = (await chrome.storage.local.get('categories')).categories as unknown[];
    const [created, ...rest] = stored;
    expect(created).toEqual({ id: expect.any(String), name: DEFAULT_CATEGORY });
    expect(rest).toEqual([null, work, nameless, { id: expect.any(String), name: 'Product', color: '#2563EB' }]);
    expect(read).toEqual([created, work, stored[4]]);
  });

  it('a Category list read takes no lock when the default Category is stored', async () => {
    uninstall();
    const locks = new FakeLockManager();
    uninstall = installNavigatorLocks(locks);

    await context().getCategories();

    expect(locks.log).toEqual([]);
  });

  it('asks the other contexts for the Prompt, Category and settings locks', async () => {
    uninstall();
    const locks = new FakeLockManager();
    uninstall = installNavigatorLocks(locks);
    const popup = context();

    await popup.savePrompt({ title: 'Saved', content: 'Body', category: DEFAULT_CATEGORY });
    await popup.updateSettings({ sortOrder: 'title' });

    expect(locks.log.filter((entry) => entry.startsWith('acquire'))).toEqual([
      'acquire StorageManager:prompts',
      'acquire StorageManager:settings'
    ]);
    expect((await chrome.storage.local.get('settings')).settings).toMatchObject({ sortOrder: 'title' });
  });

  it('a theme set in the side panel and a sort order set in the popup meanwhile are both kept', async () => {
    const sidePanel = context();
    const popup = context();
    slowRead('settings'); // the first read, whichever context makes it, is slow

    await Promise.all([sidePanel.updateSettings({ theme: 'dark' }), popup.updateSettings({ sortOrder: 'title' })]);

    expect((await chrome.storage.local.get('settings')).settings).toMatchObject({ theme: 'dark', sortOrder: 'title' });
  });

  it('a settings change paused in the side panel cannot write the settings back after Clear All Data in the popup', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1')] });
    const sidePanel = context();
    const popup = context();
    slowRead('settings'); // the side panel reads the settings, under the settings lock, then pauses

    await Promise.all([sidePanel.updateSettings({ theme: 'dark' }), popup.clearAllData()]);

    expect(await chrome.storage.local.get(null)).toEqual({});
  });

  it('Clear All Data in the popup waits for a Prompt the service worker is saving, and clears it too', async () => {
    const worker = context();
    const popup = context();
    slowRead('prompts'); // the worker's read, under the Prompts lock, returns after the popup asked to clear

    await Promise.all([
      worker.savePrompt({ title: 'Saved meanwhile', content: 'Body', category: DEFAULT_CATEGORY }),
      popup.clearAllData()
    ]);

    expect(await chrome.storage.local.get(null)).toEqual({});
  });

  it('a Prompt the service worker saves while Clear All Data runs in the popup is saved after the clear, alone', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1')] });
    const worker = context();
    const popup = context();
    const clearing = slowClear();

    const cleared = popup.clearAllData();
    await clearing; // the popup is clearing: a read of the Library now would still see p1
    const saved = await worker.savePrompt({ title: 'Saved meanwhile', content: 'Body', category: DEFAULT_CATEGORY });
    await cleared;

    expect(await storedPrompts()).toEqual([saved]);
  });

  // My-Prompt-Manager-sykt: Clear All Data took no usage history lock, so an insertion the service
  // worker was recording wrote the history back over the cleared store
  it('Clear All Data in the popup waits for an insertion the service worker is recording, and clears it too: the usage history ends empty', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1')], [USAGE_STORAGE_KEY]: [insertion('p0')] });
    const worker = usageContext();
    const popup = context();
    const { reached, resume } = pauseRead(USAGE_STORAGE_KEY);

    // The worker has read the usage history, under the usage history lock, and is about to write it
    const recorded = worker.record('p1', 'claude', null);
    await reached;
    const cleared = popup.clearAllData();
    await settle();
    // The clear waits on the usage history lock: it has removed nothing yet
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    resume();
    await Promise.all([recorded, cleared]);

    expect(await chrome.storage.local.get(null)).toEqual({});
  });

  it('an insertion the service worker records while Clear All Data runs in the popup is recorded after the clear, alone', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1')], [USAGE_STORAGE_KEY]: [insertion('p0')] });
    const worker = usageContext();
    const popup = context();
    const clearing = slowClear();

    const cleared = popup.clearAllData();
    await clearing; // the popup is clearing: a read of the usage history now would still see p0
    const recorded = worker.record('p1', 'claude', null);
    await Promise.all([recorded, cleared]);

    expect(await chrome.storage.local.get(null)).toEqual({
      [USAGE_STORAGE_KEY]: [expect.objectContaining({ promptId: 'p1', platform: 'claude' })]
    });
  });

  it('Clear All Data, insertions in the service worker and Packs added in the side panel, all at once, never wait on each other forever', async () => {
    await chrome.storage.local.set({ prompts: [prompt('p1')], [USAGE_STORAGE_KEY]: [insertion('p0')] });
    const workerUsage = usageContext();
    const worker = context();
    const sidePanel = context();
    const popup = context();
    const { reached, resume } = pauseRead(USAGE_STORAGE_KEY);

    // The service worker handles an insertion as background.ts does: the Prompt's count under the
    // Prompt lock and the usage event under the usage history lock, side by side; the event holds its lock
    const inserted = Promise.all([worker.incrementUsageCount('p1'), workerUsage.record('p1', 'claude', null)]);
    await reached;
    // The clear takes the Category, Prompt and settings locks, then waits for the usage history lock
    const cleared = popup.clearAllData();
    await settle();
    // Packs wait for the Category lock, then need the Prompt lock; a second insertion waits for the usage history lock
    const packsAdded = sidePanel.addPacks([
      { id: 'product', name: 'Product', color: '#2563EB', defaultSelected: true, prompts: [{ title: 'User story', content: 'Write a user story.' }] }
    ]);
    const insertedAgain = workerUsage.record('p2', 'claude', null);
    await settle();
    resume();

    const outcomes = await settledWithin(3000, Promise.allSettled([inserted, cleared, packsAdded, insertedAgain]));

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
    // What landed before the clear is gone; what was asked for while it ran landed after it
    expect(await storedUsage()).toEqual([expect.objectContaining({ promptId: 'p2' })]);
    expect(await storedPrompts()).toEqual([expect.objectContaining({ title: 'User story' })]);
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
