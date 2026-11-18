import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const setManifestVersion = (version: string): void => {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version } as chrome.runtime.Manifest);
};

const setDebugMode = async (debugMode: boolean): Promise<void> => {
  await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { debugMode } });
};

const seedLibrary = async (count: number): Promise<void> => {
  await chrome.storage.local.set({
    prompts: Array.from({ length: count }, (_, index) => buildPrompt({ id: `p${String(index)}`, title: `Prompt ${String(index)}` }))
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

/** The calls to chrome.storage.local.get that asked for one of the launch keys, each as its sorted key list */
const launchReads = (): string[][] =>
  vi
    .mocked(chrome.storage.local.get)
    .mock.calls.map(([keys]) => (Array.isArray(keys) ? [...keys].sort() : typeof keys === 'string' ? [keys] : []))
    .filter((keys) => keys.some((key) => LAUNCH_KEYS.includes(key)));

const storedWhatsNew = async (): Promise<unknown> => (await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY];

/** Lets a write that should not happen land */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

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
      const getPrompts = getMockStorageManager().getPrompts;
      getPrompts.mockClear();

      await openExtension();

      expect(launchReads()).toEqual([LAUNCH_KEYS]);
      expect(getPrompts).not.toHaveBeenCalled();
    });

    it.each([
      ['no record', undefined],
      ['an unreadable record', 'not a record']
    ])('%s: one get, and not the Library', async (_name, stored) => {
      await (stored === undefined ? chrome.storage.local.remove(WELCOME_KEY) : chrome.storage.local.set({ [WELCOME_KEY]: stored }));
      vi.mocked(chrome.storage.local.get).mockClear();
      const getPrompts = getMockStorageManager().getPrompts;
      getPrompts.mockClear();

      const { result } = await openExtension();

      expect(launchReads()).toEqual([LAUNCH_KEYS]);
      expect(getPrompts).not.toHaveBeenCalled();
      expect(result.current.screen.kind).not.toBe('welcome');
    });

    it('a pending record: the same one get, then the Library, once', async () => {
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      vi.mocked(chrome.storage.local.get).mockClear();
      const getPrompts = getMockStorageManager().getPrompts;
      getPrompts.mockClear();

      await openExtension();

      expect(launchReads()).toEqual([LAUNCH_KEYS]);
      expect(getPrompts).toHaveBeenCalledTimes(1);
    });
  });

  describe('the Welcome', () => {
    it.each([0, 1, 2] as const)('a first install, pending at step %i over an empty Library: the Welcome at that step', async (step) => {
      await chrome.storage.local.set({
        [WHATS_NEW_KEY]: { installedVersion: '2.0.0' },
        [WELCOME_KEY]: { status: 'pending', step },
        prompts: []
      });

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'welcome', step });
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
  });

  describe('Debug mode', () => {
    it.each([
      ['a done record and a Library with Prompts', { status: 'done' }, 2],
      ['a pending record at step 2', { status: 'pending', step: 2 }, 0],
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
      const getPrompts = getMockStorageManager().getPrompts;
      getPrompts.mockClear();

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'none' });
      expect(getPrompts).not.toHaveBeenCalled();
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('opening'),
        expect.any(Error),
        expect.objectContaining({ component: 'useLaunchScreen' })
      );
    });

    it('the Library cannot be read for a pending record: not the Welcome, and the failure logged', async () => {
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '2.0.0' }, [WELCOME_KEY]: { status: 'pending', step: 0 } });
      getMockStorageManager().getPrompts.mockRejectedValueOnce(new Error('storage unavailable'));

      const { result } = await openExtension();

      expect(result.current.screen).toEqual({ kind: 'none' });
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Library'),
        expect.any(Error),
        expect.objectContaining({ component: 'useLaunchScreen' })
      );
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
      for (let microtask = 0; microtask < 5; microtask++) {
        await Promise.resolve();
      }
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
      await chrome.storage.local.set({ [WELCOME_KEY]: { status: 'pending', step: 1 }, prompts: [] });
      const { result } = await openExtension();
      vi.mocked(chrome.storage.local.set).mockClear();

      act(() => {
        result.current.closeWhatsNew();
      });
      await settle();

      expect(result.current.screen).toEqual({ kind: 'welcome', step: 1 });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
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
    const getPrompts = getMockStorageManager().getPrompts;
    getPrompts.mockClear();

    const { result } = renderHook(() => useLaunchScreen({ enabled: false, releaseNotes: REGISTRY }));
    await settle();

    expect(result.current).toEqual(expect.objectContaining({ loading: false, screen: { kind: 'none' } }));
    expect(launchReads()).toEqual([]);
    expect(getPrompts).not.toHaveBeenCalled();
  });

  it('returns nothing that names Debug mode', async () => {
    await setDebugMode(true);

    const { result } = await openExtension();

    expect(Object.keys(result.current).sort()).toEqual(['closeWhatsNew', 'loading', 'screen']);
  });
});
