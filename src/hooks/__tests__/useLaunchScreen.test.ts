import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decideLaunch } from '../../launch/decide';
import { SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { buildPrompt } from '../../test/builders';
import { getMockStorageManager } from '../../test/mocks';
import * as Logger from '../../utils/logger';
import { WELCOME_KEY } from '../../welcome/storage';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';
import type { ReleaseNotes } from '../../whatsNew/types';
import { useLaunchScreen } from '../useLaunchScreen';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

// The real decision, watched: a test of an opening closed before its reads end checks it decided nothing
vi.mock('../../launch/decide', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../launch/decide')>();
  return { ...actual, decideLaunch: vi.fn(actual.decideLaunch) };
});

const V1_9: ReleaseNotes = {
  version: '1.9.0',
  items: [{ kind: 'feature', title: 'Older', description: 'Older feature.', icon: 'pin' }]
};
const V2_0: ReleaseNotes = {
  version: '2.0.0',
  items: [{ kind: 'feature', title: 'Search', description: 'Search everything.', icon: 'search' }]
};
const REGISTRY: readonly ReleaseNotes[] = [V1_9, V2_0];

/** The three keys the decision reads in one get */
const LAUNCH_KEYS = [SITE_SETTINGS_KEY, WELCOME_KEY, WHATS_NEW_KEY].sort();

/** The key the Library is stored under */
const LIBRARY_KEY = 'prompts';

const setManifestVersion = (version: string): void => {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version } as chrome.runtime.Manifest);
};

const setDebugMode = async (debugMode: boolean): Promise<void> => {
  await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { debugMode } });
};

const seedLibrary = async (count: number): Promise<void> => {
  await chrome.storage.local.set({
    [LIBRARY_KEY]: Array.from({ length: count }, (_, index) => buildPrompt({ id: `p${String(index)}`, title: `Prompt ${String(index)}` }))
  });
};

/** One opening of the popup over the current storage, rendered until it decided */
async function openExtension(options: Parameters<typeof useLaunchScreen>[0] = { releaseNotes: REGISTRY }) {
  const rendered = renderHook(() => useLaunchScreen(options));
  await waitFor(() => {
    expect(rendered.result.current.loading).toBe(false);
  });
  return rendered;
}

/** The keys of each call to chrome.storage.local.get, sorted */
const reads = (): string[][] =>
  vi
    .mocked(chrome.storage.local.get)
    .mock.calls.map(([keys]) => (Array.isArray(keys) ? [...keys].sort() : typeof keys === 'string' ? [keys] : []));

/** The calls to chrome.storage.local.get that asked for one of the launch keys */
const launchReads = (): string[][] => reads().filter((keys) => keys.some((key) => LAUNCH_KEYS.includes(key)));

/** The calls to chrome.storage.local.get that read the Library */
const libraryReads = (): string[][] => reads().filter((keys) => keys.includes(LIBRARY_KEY));

/** The writes of chrome.storage.local.set that touched the Welcome record */
const welcomeWrites = (): unknown[] =>
  vi.mocked(chrome.storage.local.set).mock.calls.filter(([items]) => WELCOME_KEY in (items as Record<string, unknown>));

/** The writes, removals and clears storage was asked for */
const storageChanges = (): unknown[] => [
  ...vi.mocked(chrome.storage.local.set).mock.calls,
  ...vi.mocked(chrome.storage.local.remove).mock.calls,
  ...vi.mocked(chrome.storage.local.clear).mock.calls
];

const storedWhatsNew = async (): Promise<unknown> => (await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY];
const storedWelcome = async (): Promise<unknown> => (await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY];

/** The whole of chrome.storage.local, as bytes */
const snapshot = async (): Promise<string> => JSON.stringify(await chrome.storage.local.get(null));

/** Lets a write that should not happen land */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

/** Lets only microtasks run: no timer and no task */
const microtasks = async (count: number): Promise<void> => {
  for (let microtask = 0; microtask < count; microtask++) {
    await Promise.resolve();
  }
};

/**
 * Holds every chrome.storage.local.get that asks for `key` until `release` is called; `reached`
 * resolves once one such read has started
 */
const holdReadsOf = (key: string): { release: () => void; reached: Promise<void> } => {
  const get = vi.mocked(chrome.storage.local.get);
  const readNow = get.getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
  let release!: () => void;
  let reach!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const reached = new Promise<void>((resolve) => { reach = resolve; });
  get.mockImplementation((async (keys: unknown) => {
    if (Array.isArray(keys) && keys.includes(key)) {
      reach();
      await held;
    }
    return readNow(keys);
  }) as never);
  return { release, reached };
};

/** A new user part-way through the Welcome, at `step` over an empty Library, after a first install of 2.0.0 */
const newUserAt = async (step: 0 | 1 | 2, packs?: readonly string[]): Promise<void> => {
  await chrome.storage.local.set({
    [WHATS_NEW_KEY]: { installedVersion: '2.0.0' },
    [WELCOME_KEY]: { status: 'pending', step, ...(packs === undefined ? {} : { packs }) },
    [LIBRARY_KEY]: []
  });
};

describe('useLaunchScreen', () => {
  beforeEach(async () => {
    setManifestVersion('2.0.0');
    // An existing user after the update from 1.9.0 to 2.0.0, whose Release notes ship
    await chrome.storage.local.set({
      [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' },
      [WELCOME_KEY]: { status: 'done' }
    });
    await seedLibrary(2);
  });

  it('starts loading with nothing to show, then decides', async () => {
    const { result } = renderHook(() => useLaunchScreen({ releaseNotes: REGISTRY }));

    expect(result.current.loading).toBe(true);
    expect(result.current.screen).toEqual({ kind: 'none' });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
  });

  describe('reads storage once', () => {
    it('a done record: the Welcome record, the What\'s new record and the Site settings in one get, and not the Library', async () => {
      vi.mocked(chrome.storage.local.get).mockClear();

      await openExtension();

      expect(launchReads()).toEqual([LAUNCH_KEYS]);
      expect(libraryReads()).toEqual([]);
      expect(getMockStorageManager().getPrompts).not.toHaveBeenCalled();
    });

    it.each([
      ['no record', undefined],
      ['an unreadable record', 'not a record']
    ])('%s: one get, and not the Library', async (_name, stored) => {
      await (stored === undefined ? chrome.storage.local.remove(WELCOME_KEY) : chrome.storage.local.set({ [WELCOME_KEY]: stored }));
      vi.mocked(chrome.storage.local.get).mockClear();

      const { result } = await openExtension();

      expect(launchReads()).toEqual([LAUNCH_KEYS]);
      expect(libraryReads()).toEqual([]);
      expect(result.current.screen.kind).not.toBe('welcome');
    });

    it('a pending record: the same one get, then the Library, once', async () => {
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      vi.mocked(chrome.storage.local.get).mockClear();

      await openExtension();

      expect(launchReads()).toEqual([LAUNCH_KEYS]);
      expect(libraryReads()).toEqual([[LIBRARY_KEY]]);
    });
  });

  describe('the Welcome', () => {
    it.each([0, 1, 2] as const)('a first install, pending at step %i over an empty Library: the Welcome at that step', async (step) => {
      await newUserAt(step);

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'welcome', step });
    });

    it('pending over no Library stored yet: the Welcome, the Library counts as empty', async () => {
      await newUserAt(0);
      await chrome.storage.local.remove(LIBRARY_KEY);

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'welcome', step: 0 });
    });

    it('pending with Packs selected: the Welcome at its step, with those Packs', async () => {
      await newUserAt(2, ['product', 'writing']);

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'welcome', step: 2, packs: ['product', 'writing'] });
    });

    it('the store a harness relaunch leaves (a Library, then \'install\' wrote pending over no record): the Library, no Welcome, no What\'s new', async () => {
      // Exactly what the service worker leaves after a relaunch of the command-line extension on a
      // profile with a Library and no Welcome record: 'install' records the Release and the Welcome as pending
      await chrome.storage.local.clear();
      await seedLibrary(2);
      await chrome.storage.local.set({
        [WHATS_NEW_KEY]: { installedVersion: '2.0.0' },
        [WELCOME_KEY]: { status: 'pending', step: 0 }
      });

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'none' });
    });

    it('pending, with Prompts, after an update to a Release with notes: What\'s new, not the Welcome', async () => {
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 2 } });

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
    });

    it('a popup opened before the install write (no record, an empty Library): not the Welcome, and nothing written', async () => {
      await chrome.storage.local.clear();
      vi.mocked(chrome.storage.local.set).mockClear();

      const { result } = await openExtension();
      await settle();

      expect(result.current.screen).toEqual({ kind: 'none' });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('an existing user who updated (done, a Library): never the Welcome', async () => {
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' } });

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'none' });
    });

    describe('a Library storage holds but cannot read is a doubt: neither the Welcome nor What\'s new', () => {
      it.each<[string, unknown]>([
        ['a string', 'corrupted'],
        ['an object', { 0: { id: 'p1' } }],
        ['a number', 42],
        ['null', null],
        ['a list holding no readable Prompt', [{ id: 'p1' }, 'corrupted']]
      ])('%s, pending after an update to a Release with notes', async (_label, library) => {
        await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 0 }, [LIBRARY_KEY]: library });

        const { result } = await openExtension();

        expect(result.current.screen).toEqual({ kind: 'none' });
        expect(Logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Library'),
          expect.objectContaining({ component: 'useLaunchScreen' })
        );
      });
    });
  });

  describe('resuming at the stored step (saveStep)', () => {
    it('closed at step 2: the next opening shows the Welcome at step 2, with the Packs selected', async () => {
      await newUserAt(0);
      const first = await openExtension();
      expect(first.result.current.screen).toEqual({ kind: 'welcome', step: 0 });

      act(() => {
        first.result.current.saveStep(1);
        first.result.current.saveStep(2, ['writing']);
      });
      // The popup closes right after the click, before any write has landed
      first.unmount();
      await waitFor(async () => {
        expect(await storedWelcome()).toEqual({ status: 'pending', step: 2, packs: ['writing'] });
      });

      const second = await openExtension();

      expect(second.result.current.screen).toEqual({ kind: 'welcome', step: 2, packs: ['writing'] });
    });

    it('starts the write at once, without waiting for storage or for the screen', async () => {
      await newUserAt(0);
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.get).mockClear();

      act(() => {
        result.current.saveStep(1);
      });

      // Only microtasks run (the lock's queue), no timer and no task
      await microtasks(5);
      expect(chrome.storage.local.get).toHaveBeenCalledWith([WELCOME_KEY]);
      // The screen stays the opening's decision: the Welcome holds its own step meanwhile
      expect(result.current.screen).toEqual({ kind: 'welcome', step: 0 });
    });

    it('a step without Packs keeps the Packs already selected', async () => {
      await newUserAt(2, ['product']);
      const { result } = await openExtension();

      act(() => {
        result.current.saveStep(1);
      });

      await waitFor(async () => {
        expect(await storedWelcome()).toEqual({ status: 'pending', step: 1, packs: ['product'] });
      });
    });

    it('does nothing while the Welcome does not show', async () => {
      const { result } = await openExtension();
      expect(result.current.screen.kind).not.toBe('welcome');
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.saveStep(2, ['product']);
      });
      await settle();

      expect(storageChanges()).toEqual([]);
    });

    it('logs a failed write without throwing, and the Welcome stays', async () => {
      await newUserAt(0);
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));

      expect(() => {
        act(() => {
          result.current.saveStep(1);
        });
      }).not.toThrow();

      await waitFor(() => {
        expect(Logger.error).toHaveBeenCalledWith(
          'Could not record the step the Welcome is at',
          expect.any(Error),
          expect.objectContaining({ component: 'useLaunchScreen', step: 1 })
        );
      });
      expect(result.current.screen).toEqual({ kind: 'welcome', step: 0 });
    });
  });

  describe('finishing the Welcome (finishWelcome)', () => {
    /** A new user who installed 1.9.0, left the Welcome at step 2, then got the update to 2.0.0 and its notes (decision Q2) */
    const pendingThroughAnUpdate = async (): Promise<void> => {
      await chrome.storage.local.set({
        [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' },
        [WELCOME_KEY]: { status: 'pending', step: 2 },
        [LIBRARY_KEY]: []
      });
    };

    it('shows the Library at once, then records the Welcome finished and the installed Release seen', async () => {
      await pendingThroughAnUpdate();
      const { result } = await openExtension();
      expect(result.current.screen).toEqual({ kind: 'welcome', step: 2 });

      act(() => {
        result.current.finishWelcome();
      });

      // Never What's new right after the Welcome, though 2.0.0 has notes not seen
      expect(result.current.screen).toEqual({ kind: 'none' });
      await waitFor(async () => {
        expect(await storedWelcome()).toEqual({ status: 'done' });
      });
      expect(await storedWhatsNew()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
    });

    it.each([
      ['started empty', 0],
      ['with the Packs added', 3]
    ])('%s, closed and reopened: the Library, no Welcome and no What\'s new', async (_label, promptsAdded) => {
      await pendingThroughAnUpdate();
      const first = await openExtension();
      act(() => {
        first.result.current.finishWelcome();
      });
      await seedLibrary(promptsAdded);
      first.unmount();
      await waitFor(async () => {
        expect(await storedWelcome()).toEqual({ status: 'done' });
      });

      const second = await openExtension();

      expect(second.result.current.screen).toEqual({ kind: 'none' });
    });

    it('a first install, finished: no What\'s new at the openings after, until the next Release with notes', async () => {
      await newUserAt(2);
      const first = await openExtension();
      act(() => {
        first.result.current.finishWelcome();
      });
      first.unmount();
      await waitFor(async () => {
        expect(await storedWelcome()).toEqual({ status: 'done' });
      });

      const second = await openExtension();

      expect(second.result.current.screen).toEqual({ kind: 'none' });
    });

    it('once: a second call, and a step written after it, write nothing more', async () => {
      await newUserAt(2);
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.finishWelcome();
        result.current.finishWelcome();
        result.current.saveStep(1);
      });
      await settle();

      expect(welcomeWrites()).toEqual([[{ [WELCOME_KEY]: { status: 'done' } }]]);
      expect(await storedWelcome()).toEqual({ status: 'done' });
    });

    it('does nothing while the Welcome does not show', async () => {
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      const { result } = await openExtension();
      expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.finishWelcome();
      });
      await settle();

      expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      expect(storageChanges()).toEqual([]);
    });

    it('logs a failed write without throwing, and still shows the Library', async () => {
      await newUserAt(2);
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));

      expect(() => {
        act(() => {
          result.current.finishWelcome();
        });
      }).not.toThrow();

      expect(result.current.screen).toEqual({ kind: 'none' });
      await waitFor(() => {
        expect(Logger.error).toHaveBeenCalledWith(
          'Could not record the Welcome as finished',
          expect.any(Error),
          expect.objectContaining({ component: 'useLaunchScreen', version: '2.0.0' })
        );
      });
    });
  });

  describe('Debug mode', () => {
    it.each([
      ['a done record and a Library with Prompts', { status: 'done' }, 2],
      ['a pending record at step 2', { status: 'pending', step: 2, packs: ['writing'] }, 0],
      ['no record', undefined, 0]
    ])('%s: the Welcome from step 0 at each of three openings, and nothing written', async (_name, record, prompts) => {
      await chrome.storage.local.clear();
      await seedLibrary(prompts);
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' } });
      if (record !== undefined) {
        await chrome.storage.local.set({ [WELCOME_KEY]: record });
      }
      await setDebugMode(true);
      vi.mocked(chrome.storage.local.set).mockClear();

      for (let opening = 0; opening < 3; opening++) {
        const { result, unmount } = await openExtension();
        expect(result.current.screen).toEqual({ kind: 'welcome', step: 0 });
        unmount();
      }
      await settle();

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it.each([
      ['a new user pending at step 1 with Packs over an empty Library', { status: 'pending', step: 1, packs: ['writing'] }, 0],
      ['an existing user, done, with a Library', { status: 'done' }, 2]
    ])('%s: a whole session (steps, the end, What\'s new closed) at each of three openings leaves storage byte-identical', async (_name, record, prompts) => {
      await chrome.storage.local.set({ [WELCOME_KEY]: record });
      await seedLibrary(prompts);
      await setDebugMode(true);
      const before = await snapshot();
      vi.mocked(chrome.storage.local.set).mockClear();

      for (let opening = 0; opening < 3; opening++) {
        const { result, unmount } = await openExtension();
        expect(result.current.screen).toEqual({ kind: 'welcome', step: 0 });

        act(() => {
          result.current.saveStep(1);
          result.current.saveStep(2, ['product']);
          result.current.finishWelcome();
        });
        // The Welcome first, then What's new as Debug mode forces it
        expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
        act(() => {
          result.current.closeWhatsNew();
        });
        expect(result.current.screen).toEqual({ kind: 'none' });
        unmount();
      }
      await settle();

      expect(await snapshot()).toBe(before);
      expect(storageChanges()).toEqual([]);
    });

    it('turned off after a session: exactly what the user saw before it', async () => {
      // A new user at step 1 with a Pack selected, after the update to 2.0.0 and its notes
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 1, packs: ['writing'] }, [LIBRARY_KEY]: [] });
      const beforeOpening = await openExtension();
      const shownBefore = beforeOpening.result.current.screen;
      beforeOpening.unmount();
      expect(shownBefore).toEqual({ kind: 'welcome', step: 1, packs: ['writing'] });

      await setDebugMode(true);
      const debugOpening = await openExtension();
      act(() => {
        debugOpening.result.current.saveStep(2, []);
        debugOpening.result.current.finishWelcome();
        debugOpening.result.current.closeWhatsNew();
      });
      debugOpening.unmount();
      await settle();
      await setDebugMode(false);

      const afterOpening = await openExtension();

      expect(afterOpening.result.current.screen).toEqual(shownBefore);
      expect(await storedWelcome()).toEqual({ status: 'pending', step: 1, packs: ['writing'] });
      expect(await storedWhatsNew()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });

    it('turned off, gives back the normal decision', async () => {
      await setDebugMode(true);
      const debugOpening = await openExtension();
      expect(debugOpening.result.current.screen).toEqual({ kind: 'welcome', step: 0 });
      debugOpening.unmount();

      await setDebugMode(false);
      const normalOpening = await openExtension();

      expect(normalOpening.result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
    });

    it('is read only from the stored Site settings: the localStorage debug flag does not turn it on', async () => {
      localStorage.setItem('prompt-library-debug', 'true');
      try {
        const { result } = await openExtension();
        expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      } finally {
        localStorage.removeItem('prompt-library-debug');
      }
    });
  });

  describe('a failed read', () => {
    it('storage cannot be read: nothing, and the failure logged', async () => {
      vi.mocked(chrome.storage.local.get).mockRejectedValue(new Error('storage unavailable'));

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'none' });
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('opening'),
        expect.any(Error),
        expect.objectContaining({ component: 'useLaunchScreen' })
      );
    });

    it('the Library cannot be read for a pending record: not the Welcome, and the failure logged', async () => {
      await newUserAt(0);
      const get = vi.mocked(chrome.storage.local.get);
      const readNow = get.getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
      get.mockImplementation((async (keys: unknown) => {
        if (Array.isArray(keys) && keys.includes(LIBRARY_KEY)) {
          throw new Error('storage unavailable');
        }
        return readNow(keys);
      }) as never);

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'none' });
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Library'),
        expect.any(Error),
        expect.objectContaining({ component: 'useLaunchScreen' })
      );
    });
  });

  describe('closed before the decision', () => {
    it('while the launch read is held: reads nothing more, decides nothing, and the Welcome writers do nothing', async () => {
      await newUserAt(0);
      vi.mocked(chrome.storage.local.set).mockClear();
      const { release, reached } = holdReadsOf(WELCOME_KEY);
      const { result, unmount } = renderHook(() => useLaunchScreen({ releaseNotes: REGISTRY }));
      await reached;
      vi.mocked(chrome.storage.local.get).mockClear();
      vi.mocked(decideLaunch).mockClear();

      unmount();
      release();
      await settle();
      act(() => {
        result.current.saveStep(2);
        result.current.finishWelcome();
      });
      await settle();

      expect(libraryReads()).toEqual([]);
      expect(decideLaunch).not.toHaveBeenCalled();
      expect(storageChanges()).toEqual([]);
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('while the Library read is held: decides nothing', async () => {
      await newUserAt(0);
      const { release, reached } = holdReadsOf(LIBRARY_KEY);
      const { unmount } = renderHook(() => useLaunchScreen({ releaseNotes: REGISTRY }));
      await reached;
      vi.mocked(decideLaunch).mockClear();

      unmount();
      release();
      await settle();

      expect(decideLaunch).not.toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalled();
    });
  });

  describe("closing What's new", () => {
    it('hides it at once and marks the Release as seen without waiting for storage', async () => {
      const { result } = await openExtension();
      expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      vi.mocked(chrome.storage.local.get).mockClear();

      act(() => {
        result.current.closeWhatsNew();
      });

      expect(result.current.screen).toEqual({ kind: 'none' });
      // The storage work starts in the same tick: only microtasks run (the lock's queue), no timer
      // and no task, so the exit animation never delays it
      await microtasks(5);
      expect(chrome.storage.local.get).toHaveBeenCalledWith([WHATS_NEW_KEY]);
      await waitFor(async () => {
        expect(await storedWhatsNew()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
      });
    });

    it('marks the Release seen once when called twice', async () => {
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.closeWhatsNew();
        result.current.closeWhatsNew();
      });
      await settle();

      expect(vi.mocked(chrome.storage.local.set).mock.calls.filter(([items]) => WHATS_NEW_KEY in items)).toHaveLength(1);
    });

    it('does not come back at the next opening', async () => {
      const first = await openExtension();
      act(() => {
        first.result.current.closeWhatsNew();
      });
      await waitFor(async () => {
        expect(await storedWhatsNew()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
      });
      first.unmount();

      const second = await openExtension();

      expect(second.result.current.screen).toEqual({ kind: 'none' });
    });

    it('comes back when the extension closed without an action', async () => {
      const first = await openExtension();
      expect(first.result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      first.unmount();

      const second = await openExtension();

      expect(second.result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      expect(await storedWhatsNew()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });

    it('does nothing while the Welcome shows', async () => {
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 1 }, [LIBRARY_KEY]: [] });
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.closeWhatsNew();
      });
      await settle();

      expect(result.current.screen).toEqual({ kind: 'welcome', step: 1 });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('in Debug mode: hides it and writes nothing', async () => {
      await setDebugMode(true);
      const { result } = await openExtension();
      act(() => {
        result.current.finishWelcome();
      });
      expect(result.current.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.closeWhatsNew();
      });
      await settle();

      expect(result.current.screen).toEqual({ kind: 'none' });
      expect(storageChanges()).toEqual([]);
    });

    it('logs a failed write without throwing, and still hides What\'s new', async () => {
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));

      expect(() => {
        act(() => {
          result.current.closeWhatsNew();
        });
      }).not.toThrow();

      expect(result.current.screen).toEqual({ kind: 'none' });
      await waitFor(() => {
        expect(Logger.error).toHaveBeenCalledWith(
          'Could not mark the Release as seen',
          expect.any(Error),
          expect.objectContaining({ component: 'useLaunchScreen', version: '2.0.0' })
        );
      });
    });
  });

  it('turned off (the element picker\'s Settings window): reads nothing and shows nothing', async () => {
    vi.mocked(chrome.storage.local.get).mockClear();

    const { result } = renderHook(() => useLaunchScreen({ enabled: false, releaseNotes: REGISTRY }));
    await settle();

    expect(result.current).toEqual(expect.objectContaining({ loading: false, screen: { kind: 'none' } }));
    expect(launchReads()).toEqual([]);
    expect(libraryReads()).toEqual([]);
  });

  it('returns nothing that names Debug mode', async () => {
    await setDebugMode(true);

    const { result } = await openExtension();

    expect(Object.keys(result.current).sort()).toEqual(['closeWhatsNew', 'finishWelcome', 'loading', 'saveStep', 'screen']);
  });
});
