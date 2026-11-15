import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { decideWhatsNew, isFirstInstall } from '../../whatsNew/decide';
import { readWhatsNewRecord, WHATS_NEW_KEY } from '../../whatsNew/storage';
import type { ReleaseNotes } from '../../whatsNew/types';

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

const setManifestVersion = (version: string): void => {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version } as chrome.runtime.Manifest);
};

const setDebugMode = async (debugMode: boolean): Promise<void> => {
  await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { debugMode } });
};

/**
 * One opening of the popup: a fresh copy of the hook module (memory reset, as after the
 * extension closed or the browser restarted) over the same storage, rendered until it decided.
 */
async function openExtension() {
  vi.resetModules();
  const { useWhatsNew } = await import('../useWhatsNew');
  const rendered = renderHook(() => useWhatsNew(REGISTRY));
  await waitFor(() => {
    expect(rendered.result.current.loading).toBe(false);
  });
  return rendered;
}

const storedRecord = async (): Promise<unknown> => (await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY];

describe('useWhatsNew', () => {
  beforeEach(async () => {
    setManifestVersion('2.0.0');
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' } });
  });

  it('starts loading, then gives the notes of a new Release that has them', async () => {
    vi.resetModules();
    const { useWhatsNew } = await import('../useWhatsNew');
    const { result } = renderHook(() => useWhatsNew(REGISTRY));

    expect(result.current.loading).toBe(true);
    expect(result.current.notes).toBeNull();
    await waitFor(() => {
      expect(result.current.notes).toBe(V2_0);
    });
    expect(result.current.loading).toBe(false);
  });

  it('gives no notes on a first install', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '2.0.0' } });

    const { result } = await openExtension();

    expect(result.current.notes).toBeNull();
  });

  describe('an opening before the service worker recorded the install', () => {
    it('shows nothing on an empty record, and writes no Last seen Release', async () => {
      await chrome.storage.local.remove(WHATS_NEW_KEY);

      const { result } = await openExtension();

      expect(result.current.notes).toBeNull();
      expect(await storedRecord()).toBeUndefined();
    });

    it('shows the notes on an empty record in Debug mode', async () => {
      await chrome.storage.local.remove(WHATS_NEW_KEY);
      await setDebugMode(true);

      const { result } = await openExtension();

      expect(result.current.notes).toBe(V2_0);
    });

    it('shows the notes at the next opening, once the update recorded an older Release of install', async () => {
      await chrome.storage.local.remove(WHATS_NEW_KEY);
      const first = await openExtension();
      expect(first.result.current.notes).toBeNull();
      first.unmount();

      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0' } });
      const second = await openExtension();

      expect(second.result.current.notes).toBe(V2_0);
    });
  });

  it('close() hides the notes at once and marks the Release as seen', async () => {
    const { result } = await openExtension();
    expect(result.current.notes).toBe(V2_0);
    vi.mocked(chrome.storage.local.get).mockClear();

    act(() => {
      result.current.close();
    });

    expect(result.current.notes).toBeNull();
    // The storage work starts in the same tick as close(): only microtasks run (the lock's queue),
    // no timer and no task, so the exit animation never delays it
    for (let microtask = 0; microtask < 5; microtask++) {
      await Promise.resolve();
    }
    expect(chrome.storage.local.get).toHaveBeenCalledWith([WHATS_NEW_KEY]);
    await waitFor(async () => {
      expect(await storedRecord()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
    });
  });

  it('does not come back after closing, even after a restart', async () => {
    const first = await openExtension();
    act(() => {
      first.result.current.close();
    });
    await waitFor(async () => {
      expect(await storedRecord()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
    });
    first.unmount();

    const second = await openExtension();

    expect(second.result.current.notes).toBeNull();
  });

  it('comes back when the extension closed without an action', async () => {
    const first = await openExtension();
    expect(first.result.current.notes).toBe(V2_0);
    first.unmount();

    const second = await openExtension();

    expect(second.result.current.notes).toBe(V2_0);
    expect(await storedRecord()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
  });

  it('leaves the Last seen Release unchanged through a Debug session, and the normal decision is the one before', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' } });
    const before = await readWhatsNewRecord();
    const decisionBefore = decideWhatsNew({
      currentVersion: '2.0.0',
      lastSeenVersion: before.lastSeenVersion,
      releaseNotes: REGISTRY,
      isFirstInstall: isFirstInstall(before.installedVersion, '2.0.0'),
      debugMode: false
    });
    const normalBefore = await openExtension();
    expect(normalBefore.result.current.notes).toBe(decisionBefore);
    expect(decisionBefore).toBeNull();
    normalBefore.unmount();

    // Debug mode on: the notes show at every opening, and closing writes nothing
    await setDebugMode(true);
    vi.mocked(chrome.storage.local.set).mockClear();
    for (let opening = 0; opening < 2; opening++) {
      const debugOpening = await openExtension();
      expect(debugOpening.result.current.notes).toBe(V2_0);
      act(() => {
        debugOpening.result.current.close();
      });
      expect(debugOpening.result.current.notes).toBeNull();
      debugOpening.unmount();
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(await readWhatsNewRecord()).toEqual(before);

    // Debug mode off: the same decision as before the Debug session
    await setDebugMode(false);
    const normalAfter = await openExtension();
    expect(normalAfter.result.current.notes).toBe(decisionBefore);
  });

  it('in Debug mode, a Release without notes shows the newest Release that has notes', async () => {
    setManifestVersion('2.0.1');
    await setDebugMode(true);

    const { result } = await openExtension();

    expect(result.current.notes).toBe(V2_0);
  });

  it('gives no notes and logs when storage cannot be read', async () => {
    vi.mocked(chrome.storage.local.get).mockRejectedValue(new Error('storage unavailable'));

    const { result } = await openExtension();
    const Logger = await import('../../utils/logger');

    expect(result.current.notes).toBeNull();
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining("What's new"),
      expect.any(Error),
      expect.objectContaining({ component: 'useWhatsNew' })
    );
  });

  it('logs a failed write at close() without throwing, and still hides the notes', async () => {
    const { result } = await openExtension();
    const Logger = await import('../../utils/logger');
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));

    expect(() => {
      act(() => {
        result.current.close();
      });
    }).not.toThrow();

    expect(result.current.notes).toBeNull();
    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        'Could not mark the Release as seen',
        expect.any(Error),
        expect.objectContaining({ component: 'useWhatsNew', version: '2.0.0' })
      );
    });
  });

  it('returns nothing that names Debug mode', async () => {
    await setDebugMode(true);

    const { result } = await openExtension();

    expect(Object.keys(result.current).sort()).toEqual(['close', 'loading', 'notes']);
  });

  describe("debug mode shows What's new at every opening", () => {
    /** The stored What's new record exactly as storage holds it, serialized */
    const rawRecord = async (): Promise<string | undefined> => JSON.stringify(await storedRecord());

    it('shows the notes when the installed Release is the Last seen Release', async () => {
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' } });
      await setDebugMode(true);

      for (let opening = 0; opening < 3; opening++) {
        const { result, unmount } = await openExtension();
        expect(result.current.notes).toBe(V2_0);
        unmount();
      }
    });

    it('shows the notes on a first install', async () => {
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '2.0.0' } });
      await setDebugMode(true);

      for (let opening = 0; opening < 3; opening++) {
        const { result, unmount } = await openExtension();
        expect(result.current.notes).toBe(V2_0);
        unmount();
      }
    });

    it("closing leaves the stored What's new record byte-identical", async () => {
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' } });
      await setDebugMode(true);
      const before = await rawRecord();

      for (let opening = 0; opening < 3; opening++) {
        const { result, unmount } = await openExtension();
        expect(result.current.notes).toBe(V2_0);
        act(() => {
          result.current.close();
        });
        expect(result.current.notes).toBeNull();
        unmount();
      }
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await rawRecord()).toBe(before);
      expect(before).toBe('{"installedVersion":"1.9.0","lastSeenVersion":"1.9.0"}');
    });

    it('closing leaves an absent record absent', async () => {
      await chrome.storage.local.remove(WHATS_NEW_KEY);
      await setDebugMode(true);

      const { result } = await openExtension();
      expect(result.current.notes).toBe(V2_0);
      act(() => {
        result.current.close();
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await storedRecord()).toBeUndefined();
    });

    it('turned off, gives back the normal decision with the Last seen Release as it was', async () => {
      // Seen 2.0.0: the normal decision shows nothing, Debug mode shows the notes, off again shows nothing
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' } });
      await setDebugMode(true);
      const debugOpening = await openExtension();
      expect(debugOpening.result.current.notes).toBe(V2_0);
      act(() => {
        debugOpening.result.current.close();
      });
      debugOpening.unmount();

      await setDebugMode(false);
      const normalOpening = await openExtension();
      expect(normalOpening.result.current.notes).toBeNull();
      expect(await storedRecord()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
    });

    it('turned off after closing an unseen Release in Debug mode, still shows it, as the normal rule says', async () => {
      // Last seen 1.9.0: a close in Debug mode does not mark 2.0.0 as seen
      await setDebugMode(true);
      const debugOpening = await openExtension();
      act(() => {
        debugOpening.result.current.close();
      });
      debugOpening.unmount();

      await setDebugMode(false);
      const normalOpening = await openExtension();
      expect(normalOpening.result.current.notes).toBe(V2_0);
      expect(await storedRecord()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });

    it('is read only from the stored Site settings: the localStorage debug flag does not turn it on', async () => {
      await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' } });
      await setDebugMode(false);
      localStorage.setItem('prompt-library-debug', 'true');
      try {
        const { result } = await openExtension();
        expect(result.current.notes).toBeNull();
      } finally {
        localStorage.removeItem('prompt-library-debug');
      }
    });
  });
});
