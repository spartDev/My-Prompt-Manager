import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { decideWhatsNew } from '../../whatsNew/decide';
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
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '1.9.0' } });
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

  it('close() hides the notes at once and marks the Release as seen', async () => {
    const { result } = await openExtension();
    expect(result.current.notes).toBe(V2_0);

    act(() => {
      result.current.close();
    });

    expect(result.current.notes).toBeNull();
    await waitFor(async () => {
      expect(await storedRecord()).toEqual({ lastSeenVersion: '2.0.0' });
    });
  });

  it('does not come back after closing, even after a restart', async () => {
    const first = await openExtension();
    act(() => {
      first.result.current.close();
    });
    await waitFor(async () => {
      expect(await storedRecord()).toEqual({ lastSeenVersion: '2.0.0' });
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
    expect(await storedRecord()).toEqual({ lastSeenVersion: '1.9.0' });
  });

  it('leaves the Last seen Release unchanged through a Debug session, and the normal decision is the one before', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '2.0.0' } });
    const before = await readWhatsNewRecord();
    const decisionBefore = decideWhatsNew({
      currentVersion: '2.0.0',
      lastSeenVersion: before.lastSeenVersion,
      releaseNotes: REGISTRY,
      isFirstInstall: before.installedVersion === '2.0.0',
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
});
