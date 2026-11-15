import { describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

type InstalledListener = (details: chrome.runtime.InstalledDetails) => void;

/** Loads the background script afresh and returns its chrome.runtime.onInstalled listener and Logger. */
async function loadBackground(): Promise<{ onInstalled: InstalledListener; Logger: typeof import('../../utils/logger') }> {
  vi.resetModules();
  const addInstalled = vi.mocked(getChromeMock().runtime.onInstalled.addListener);
  addInstalled.mockClear();

  await import('../background');
  const Logger = await import('../../utils/logger');

  const onInstalled = addInstalled.mock.calls[addInstalled.mock.calls.length - 1]?.[0];
  if (!onInstalled) {
    throw new Error('The background script did not register a chrome.runtime.onInstalled listener');
  }
  return { onInstalled, Logger };
}

const storedRecord = async (): Promise<unknown> => (await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY];

const setManifestVersion = (version: string): void => {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({
    version,
    content_scripts: [{ js: ['content.js'] }]
  } as chrome.runtime.Manifest);
};

describe("background: the What's new record on install and update", () => {
  it('records installedVersion = the manifest version on a first install', async () => {
    setManifestVersion('2.0.0');
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'install' });

    await vi.waitFor(async () => {
      expect(await storedRecord()).toEqual({ installedVersion: '2.0.0' });
    });
  });

  it('records installedVersion = previousVersion on an update when the record has none, keeping the Last seen Release', async () => {
    setManifestVersion('2.0.0');
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '1.9.0' } });
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'update', previousVersion: '1.9.0' });

    await vi.waitFor(async () => {
      expect(await storedRecord()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });
  });

  it('records installedVersion = previousVersion on an update when there is no record', async () => {
    setManifestVersion('2.0.0');
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'update', previousVersion: '1.9.0' });

    await vi.waitFor(async () => {
      expect(await storedRecord()).toEqual({ installedVersion: '1.9.0' });
    });
  });

  it.each([
    ['an existing Release of install', { installedVersion: '1.8.0', lastSeenVersion: '1.9.0' }, '1.9.0'],
    ['an empty previousVersion', { lastSeenVersion: '1.9.0' }, '']
  ])('writes nothing to whatsNew on an update with %s', async (_label, record, previousVersion) => {
    setManifestVersion('2.0.0');
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: record });
    vi.mocked(chrome.storage.local.set).mockClear();
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'update', previousVersion });

    // Let the update's other work (interface mode, upgrade pass, re-injection) run
    await vi.waitFor(() => {
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const whatsNewWrites = vi
      .mocked(chrome.storage.local.set)
      .mock.calls.filter(([items]) => WHATS_NEW_KEY in (items as Record<string, unknown>));
    expect(whatsNewWrites).toEqual([]);
    expect(await storedRecord()).toEqual(record);
  });

  it('logs a failed record of an update instead of throwing', async () => {
    setManifestVersion('2.0.0');
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    const { onInstalled, Logger } = await loadBackground();

    expect(() => {
      onInstalled({ reason: 'update', previousVersion: '1.9.0' });
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        'Could not record the Release the update came from',
        expect.any(Error),
        expect.objectContaining({ component: 'Background', previousVersion: '1.9.0' })
      );
    });
  });

  it('logs a failed record instead of throwing', async () => {
    setManifestVersion('2.0.0');
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    const { onInstalled, Logger } = await loadBackground();

    expect(() => {
      onInstalled({ reason: 'install' });
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        'Could not record the Release of the first install',
        expect.any(Error),
        expect.objectContaining({ component: 'Background', version: '2.0.0' })
      );
    });
  });
});
