import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageManager } from '../../services/storage';
import { FakeLockManager, installNavigatorLocks } from '../../test/utils/FakeLockManager';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';
import {
  markExistingUserDone,
  parseWelcomeRecord,
  readWelcomeRecord,
  recordWelcomePending,
  WELCOME_KEY,
  type WelcomeRecord,
  writeWelcomeRecord
} from '../storage';

const stored = async (): Promise<unknown> => (await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY];

/** The writes of chrome.storage.local.set that touched the Welcome record */
const welcomeWrites = (): unknown[] =>
  vi
    .mocked(chrome.storage.local.set)
    .mock.calls.filter(([items]) => WELCOME_KEY in (items as Record<string, unknown>));

/**
 * The welcome module of another context of the extension (the service worker, a second popup or
 * the side panel): its own module instance, so its own lock object, over the shared storage
 */
const otherContext = async (): Promise<typeof import('../storage')> => {
  vi.resetModules();
  return import('../storage');
};

/** Pauses the next read of the Welcome record once it has read storage, until `resume` is called */
const pauseNextWelcomeRead = (): { resume: () => void; reached: Promise<void> } => {
  const get = vi.mocked(chrome.storage.local.get);
  const readNow = get.getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
  let resume!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  let paused = false;
  get.mockImplementation((async (keys: unknown) => {
    const result = await readNow(keys);
    if (!paused && Array.isArray(keys) && keys.includes(WELCOME_KEY)) {
      paused = true;
      reached();
      await gate;
    }
    return result;
  }) as never);
  return { resume, reached: reachedPromise };
};

/** Lets every queued microtask and timer of the other context run */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('Welcome record: parsing', () => {
  it.each<[string, WelcomeRecord]>([
    ['pending at the first step', { status: 'pending', step: 0 }],
    ['pending at the second step', { status: 'pending', step: 1 }],
    ['pending at the last step with Packs', { status: 'pending', step: 2, packs: ['product', 'writing'] }],
    ['pending with no Pack selected', { status: 'pending', step: 2, packs: [] }],
    ['done', { status: 'done' }]
  ])('reads a valid record (%s) as it is', (_label, record) => {
    expect(parseWelcomeRecord(record)).toEqual(record);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['an array', [{ status: 'pending', step: 0 }]],
    ['a string', 'done'],
    ['a number', 0],
    ['a boolean', true],
    ['an empty object', {}],
    ['an unknown status', { status: 'finished' }],
    ['a status in another case', { status: 'PENDING', step: 0 }],
    ['a status that is not a string', { status: 1, step: 0 }],
    ['no status', { step: 1, packs: ['product'] }]
  ])('reads a malformed value (%s) as no record, without throwing', (_label, value) => {
    expect(() => parseWelcomeRecord(value)).not.toThrow();
    expect(parseWelcomeRecord(value)).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ['-1', -1],
    ['3', 3],
    ['1.5', 1.5],
    ["'1'", '1'],
    ['NaN', Number.NaN],
    ['null', null],
    ['missing', undefined]
  ])('reads a pending record whose step is %s as pending at the first step', (_label, step) => {
    const value = step === undefined ? { status: 'pending' } : { status: 'pending', step };

    expect(() => parseWelcomeRecord(value)).not.toThrow();
    expect(parseWelcomeRecord(value)).toEqual({ status: 'pending', step: 0 });
  });

  it.each<[string, unknown]>([
    ['a string', 'product'],
    ['a list holding a number', ['product', 2]],
    ['a list holding null', [null]],
    ['null', null],
    ['an object', { 0: 'product' }]
  ])('leaves out Packs that are not a list of strings (%s) and keeps the step', (_label, packs) => {
    const value = { status: 'pending', step: 1, packs };

    expect(() => parseWelcomeRecord(value)).not.toThrow();
    expect(parseWelcomeRecord(value)).toEqual({ status: 'pending', step: 1 });
  });

  it('leaves out the fields a record does not have', () => {
    expect(parseWelcomeRecord({ status: 'done', step: 2, packs: ['product'], finishedAt: 1 })).toEqual({ status: 'done' });
    expect(parseWelcomeRecord({ status: 'pending', step: 1, packs: ['product'], extra: 'x' })).toEqual({
      status: 'pending',
      step: 1,
      packs: ['product']
    });
  });
});

describe('Welcome record: reading', () => {
  it('reads a missing key as no record', async () => {
    await expect(readWelcomeRecord()).resolves.toBeUndefined();
  });

  it('reads a stored record', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 1, packs: ['writing'] } });

    await expect(readWelcomeRecord()).resolves.toEqual({ status: 'pending', step: 1, packs: ['writing'] });
  });

  it('reads a malformed stored value as no record', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: 'corrupted' });

    await expect(readWelcomeRecord()).resolves.toBeUndefined();
  });

  it('rejects when storage cannot be read', async () => {
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(readWelcomeRecord()).rejects.toThrow('storage unavailable');
  });
});

describe('Welcome record: writeWelcomeRecord', () => {
  it('writes the step reached and its Packs', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 0 } });

    await expect(writeWelcomeRecord({ status: 'pending', step: 2, packs: ['product'] })).resolves.toBe(true);

    expect(await stored()).toEqual({ status: 'pending', step: 2, packs: ['product'] });
  });

  it('writes the end over a pending record', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 2 } });

    await expect(writeWelcomeRecord({ status: 'done' })).resolves.toBe(true);

    expect(await stored()).toEqual({ status: 'done' });
  });

  it.each<[string, WelcomeRecord]>([
    ['a step', { status: 'pending', step: 1 }],
    ['the first step', { status: 'pending', step: 0 }],
    ['the end again', { status: 'done' }]
  ])('never replaces a done record (%s)', async (_label, record) => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'done' } });
    vi.mocked(chrome.storage.local.set).mockClear();

    await expect(writeWelcomeRecord(record)).resolves.toBe(false);

    expect(welcomeWrites()).toEqual([]);
    expect(await stored()).toEqual({ status: 'done' });
  });

  it('stores only the fields of the record', async () => {
    const withExtra = { status: 'pending', step: 1, packs: ['product'], extra: 'x' } as WelcomeRecord;

    await writeWelcomeRecord(withExtra);

    expect(await stored()).toEqual({ status: 'pending', step: 1, packs: ['product'] });
  });

  it('rejects, with storage untouched, when storage cannot be written', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

    await expect(writeWelcomeRecord({ status: 'pending', step: 1 })).rejects.toThrow('QUOTA_BYTES');
    expect(await stored()).toEqual({ status: 'pending', step: 0 });
  });

  it('rejects, writing nothing, when storage cannot be read', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'done' } });
    vi.mocked(chrome.storage.local.set).mockClear();
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(writeWelcomeRecord({ status: 'pending', step: 1 })).rejects.toThrow('storage unavailable');
    expect(welcomeWrites()).toEqual([]);
    expect(await stored()).toEqual({ status: 'done' });
  });
});

describe('Welcome record: recordWelcomePending (first install)', () => {
  it('writes the Welcome as pending at the first step on an empty store', async () => {
    await expect(recordWelcomePending()).resolves.toBe(true);

    expect(await stored()).toEqual({ status: 'pending', step: 0 });
  });

  it('replaces a value it cannot read as a record', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'finished' } });

    await expect(recordWelcomePending()).resolves.toBe(true);

    expect(await stored()).toEqual({ status: 'pending', step: 0 });
  });

  it.each<[string, WelcomeRecord]>([
    ['a done record: a finished Welcome stays finished', { status: 'done' }],
    ['a pending record: the Welcome resumes at its step, with its Packs', { status: 'pending', step: 2, packs: ['writing'] }]
  ])('keeps %s', async (_label, record) => {
    await chrome.storage.local.set({ [WELCOME_KEY]: record });
    vi.mocked(chrome.storage.local.set).mockClear();

    await expect(recordWelcomePending()).resolves.toBe(false);

    expect(welcomeWrites()).toEqual([]);
    expect(await stored()).toEqual(record);
  });
});

describe('Welcome record: markExistingUserDone (update)', () => {
  it('marks the Welcome done when there is no record: the store of a user of 1.9.0 or earlier', async () => {
    await chrome.storage.local.set({ prompts: [{ id: 'p1' }], whatsNew: { lastSeenVersion: '1.9.0' } });

    await expect(markExistingUserDone()).resolves.toBe(true);

    expect(await stored()).toEqual({ status: 'done' });
  });

  it.each<[string, unknown]>([
    ['a string', 'corrupted'],
    ['an unknown status', { status: 'finished' }],
    ['an array', [{ status: 'pending', step: 0 }]]
  ])('marks the Welcome done when the stored value is not a record (%s)', async (_label, value) => {
    await chrome.storage.local.set({ [WELCOME_KEY]: value });

    await expect(markExistingUserDone()).resolves.toBe(true);

    expect(await stored()).toEqual({ status: 'done' });
  });

  it.each<[string, WelcomeRecord]>([
    ['a pending record (decision Q2: the Welcome resumes after the update)', { status: 'pending', step: 1, packs: ['product'] }],
    ['a done record', { status: 'done' }]
  ])('keeps %s', async (_label, record) => {
    await chrome.storage.local.set({ [WELCOME_KEY]: record });
    vi.mocked(chrome.storage.local.set).mockClear();

    await expect(markExistingUserDone()).resolves.toBe(false);

    expect(welcomeWrites()).toEqual([]);
    expect(await stored()).toEqual(record);
  });

  it('rejects, writing nothing, when storage cannot be read', async () => {
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(markExistingUserDone()).rejects.toThrow('storage unavailable');
    expect(welcomeWrites()).toEqual([]);
    expect(await stored()).toBeUndefined();
  });
});

describe('Welcome record: across contexts', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installNavigatorLocks(new FakeLockManager());
  });

  afterEach(() => {
    uninstall();
  });

  it('a step written in the side panel while the popup finishes the Welcome cannot bring it back', async () => {
    await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 1 } });
    const sidePanel = await otherContext();
    const popup = await otherContext();
    const { resume, reached } = pauseNextWelcomeRead();

    // The side panel has read the pending record and is about to write its step
    const stepWritten = sidePanel.writeWelcomeRecord({ status: 'pending', step: 2 });
    await reached;
    // The popup finishes meanwhile: it waits for the side panel's write, then writes the end
    const finished = popup.writeWelcomeRecord({ status: 'done' });
    await settle();
    resume();

    await expect(Promise.all([stepWritten, finished])).resolves.toEqual([true, true]);
    expect(await stored()).toEqual({ status: 'done' });
  });
});

describe('Welcome record: kept across Clear All Data', () => {
  const WHATS_NEW = { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' };
  const OTHER_KEYS = {
    prompts: [],
    categories: [{ id: 'default', name: 'Uncategorized' }],
    settings: { defaultCategory: 'Uncategorized', sortOrder: 'updatedAt' },
    promptLibrarySettings: { enabledSites: [], customSites: [], debugMode: true },
    interfaceMode: 'sidepanel',
    iconPlacementRepairs: {},
    usageHistory: [],
    toast_settings: { enabled: true }
  };

  it.each<[string, WelcomeRecord]>([
    ['a done record', { status: 'done' }],
    ['a pending record', { status: 'pending', step: 2, packs: ['product'] }]
  ])('Clear All Data leaves the Welcome record (%s) and the What\'s new record, and removes every other key', async (_label, record) => {
    await chrome.storage.local.set({ ...OTHER_KEYS, [WHATS_NEW_KEY]: WHATS_NEW, [WELCOME_KEY]: record });

    await StorageManager.getInstance().clearAllData();

    expect(await chrome.storage.local.get(null)).toEqual({ [WHATS_NEW_KEY]: WHATS_NEW, [WELCOME_KEY]: record });
  });

  it('Clear All Data keeps a Welcome value it cannot parse as it was, and never rewrites the records', async () => {
    await chrome.storage.local.set({ ...OTHER_KEYS, [WELCOME_KEY]: 'corrupted' });
    vi.mocked(chrome.storage.local.set).mockClear();

    await StorageManager.getInstance().clearAllData();

    expect(await chrome.storage.local.get(null)).toEqual({ [WELCOME_KEY]: 'corrupted' });
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.clear).not.toHaveBeenCalled();
    expect(vi.mocked(chrome.storage.local.remove).mock.calls[0]?.[0]).not.toContain(WELCOME_KEY);
  });

  describe('with the locks shared across contexts', () => {
    let uninstall: () => void;
    let locks: FakeLockManager;

    beforeEach(() => {
      locks = new FakeLockManager();
      uninstall = installNavigatorLocks(locks);
    });

    afterEach(() => {
      uninstall();
    });

    it("takes the documented locks in order, the What's new lock then the Welcome lock last", async () => {
      await StorageManager.getInstance().clearAllData();

      expect(locks.log.filter((entry) => entry.startsWith('acquire'))).toEqual([
        'acquire StorageManager:categories',
        'acquire StorageManager:prompts',
        'acquire StorageManager:settings',
        'acquire SiteSettings:promptLibrarySettings',
        'acquire IconPlacementRepairs:iconPlacementRepairs',
        `acquire WhatsNew:${WHATS_NEW_KEY}`,
        `acquire Welcome:${WELCOME_KEY}`
      ]);
    });

    it('a Welcome write asked for in the service worker while Clear All Data runs in the popup lands after the clear, never in between', async () => {
      await chrome.storage.local.set({ ...OTHER_KEYS, [WELCOME_KEY]: { status: 'pending', step: 0 } });
      const worker = await otherContext();
      // The removal of the clear waits until released, so the worker can act while it runs
      const remove = vi.mocked(chrome.storage.local.remove).getMockImplementation() as unknown as (keys: string[]) => Promise<void>;
      let releaseRemoval!: () => void;
      const removalGate = new Promise<void>((resolve) => { releaseRemoval = resolve; });
      const removalStarted = new Promise<void>((started) => {
        vi.mocked(chrome.storage.local.remove).mockImplementationOnce((async (keys: string[]) => {
          started();
          await removalGate;
          return remove(keys);
        }) as never);
      });

      const cleared = StorageManager.getInstance().clearAllData();
      await removalStarted;
      const written = worker.writeWelcomeRecord({ status: 'pending', step: 1 });
      await settle();
      // Mid-clear: the write waits on the Welcome lock, so the record is still the one before it
      expect(await stored()).toEqual({ status: 'pending', step: 0 });
      releaseRemoval();

      await expect(Promise.all([cleared, written])).resolves.toEqual([undefined, true]);
      expect(await chrome.storage.local.get(null)).toEqual({ [WELCOME_KEY]: { status: 'pending', step: 1 } });
    });

    it('Clear All Data asked for in the popup while the service worker writes the Welcome record waits for the write, then clears around it', async () => {
      await chrome.storage.local.set(OTHER_KEYS);
      const worker = await otherContext();
      const { resume, reached } = pauseNextWelcomeRead();

      // The service worker, at an update, has read no record and is about to mark the Welcome done
      const marked = worker.markExistingUserDone();
      await reached;
      const cleared = StorageManager.getInstance().clearAllData();
      await settle();
      // The clear waits on the Welcome lock: it has removed nothing yet
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
      resume();

      await expect(Promise.all([marked, cleared])).resolves.toEqual([true, undefined]);
      expect(await chrome.storage.local.get(null)).toEqual({ [WELCOME_KEY]: { status: 'done' } });
    });
  });
});
