import { describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';
import { WELCOME_KEY, type WelcomeRecord } from '../../welcome/storage';

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

const storedRecord = async (): Promise<unknown> => (await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY];

/** The writes of chrome.storage.local.set that touched the Welcome record */
const welcomeWrites = (): unknown[] =>
  vi
    .mocked(chrome.storage.local.set)
    .mock.calls.filter(([items]) => WELCOME_KEY in (items as Record<string, unknown>));

/**
 * Waits until the listener's work for `reason` has run: the interface mode applied for every
 * reason, the content scripts re-injected for an update, then a turn for the record writes
 */
const settled = async (reason: chrome.runtime.InstalledDetails['reason']): Promise<void> => {
  await vi.waitFor(() => {
    expect(chrome.action.setPopup).toHaveBeenCalled();
    if (reason === 'update') {
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
};

const setManifestVersion = (version: string): void => {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({
    version,
    content_scripts: [{ js: ['content.js'] }]
  } as chrome.runtime.Manifest);
};

describe('background: the Welcome record on install and update', () => {
  it("'install' writes the Welcome as pending at the first step", async () => {
    setManifestVersion('2.0.0');
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'install' });

    await vi.waitFor(async () => {
      expect(await storedRecord()).toEqual({ status: 'pending', step: 0 });
    });
  });

  it.each<[string, WelcomeRecord]>([
    ['a done record (a finished Welcome stays finished)', { status: 'done' }],
    ['a pending record (it resumes at its step)', { status: 'pending', step: 2, packs: ['product'] }]
  ])("'install' keeps %s: Chromium fires 'install' again, store kept, at each launch of an extension loaded from the command line", async (_label, record) => {
    setManifestVersion('2.0.0');
    await chrome.storage.local.set({ [WELCOME_KEY]: record });
    vi.mocked(chrome.storage.local.set).mockClear();
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'install' });

    await settled('install');
    expect(welcomeWrites()).toEqual([]);
    expect(await storedRecord()).toEqual(record);
  });

  it.each<[string, string]>([
    ['from 1.9.0', '1.9.0'],
    ['with an empty previous version', '']
  ])("'update' %s with no Welcome record writes the Welcome as done: an existing user never sees it", async (_label, previousVersion) => {
    setManifestVersion('2.0.0');
    // The store of a 1.9.0 user: a Library, no Welcome record
    await chrome.storage.local.set({ prompts: [{ id: 'p1', title: 'Draft email', content: 'Hello' }] });
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'update', previousVersion });

    await vi.waitFor(async () => {
      expect(await storedRecord()).toEqual({ status: 'done' });
    });
  });

  it("'update' over a value that is not a record writes the Welcome as done", async () => {
    setManifestVersion('2.0.0');
    await chrome.storage.local.set({ [WELCOME_KEY]: 'corrupted' });
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'update', previousVersion: '1.9.0' });

    await vi.waitFor(async () => {
      expect(await storedRecord()).toEqual({ status: 'done' });
    });
  });

  it.each<[string, WelcomeRecord]>([
    ['a done record', { status: 'done' }],
    ['a pending record (decision Q2: the Welcome resumes after the update)', { status: 'pending', step: 1, packs: ['writing'] }]
  ])("'update' leaves %s as it is", async (_label, record) => {
    setManifestVersion('2.0.0');
    await chrome.storage.local.set({ [WELCOME_KEY]: record });
    vi.mocked(chrome.storage.local.set).mockClear();
    const { onInstalled } = await loadBackground();

    onInstalled({ reason: 'update', previousVersion: '1.9.0' });

    await settled('update');
    expect(welcomeWrites()).toEqual([]);
    expect(await storedRecord()).toEqual(record);
  });

  it.each<[string, chrome.runtime.InstalledDetails]>([
    ['chrome_update', { reason: 'chrome_update' }],
    ['shared_module_update', { reason: 'shared_module_update', id: 'a-shared-module' }]
  ])("'%s' writes no Welcome record, even on a store that has none", async (_label, details) => {
    setManifestVersion('2.0.0');
    const { onInstalled } = await loadBackground();

    onInstalled(details);

    await settled(details.reason);
    expect(welcomeWrites()).toEqual([]);
    expect(await storedRecord()).toBeUndefined();
  });

  it("logs a failed record of the first install instead of throwing", async () => {
    setManifestVersion('2.0.0');
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    const { onInstalled, Logger } = await loadBackground();

    expect(() => {
      onInstalled({ reason: 'install' });
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        'Could not record the Welcome of the first install',
        expect.any(Error),
        expect.objectContaining({ component: 'Background' })
      );
    });
  });

  it('logs a failed mark of an update instead of throwing', async () => {
    setManifestVersion('2.0.0');
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    const { onInstalled, Logger } = await loadBackground();

    expect(() => {
      onInstalled({ reason: 'update', previousVersion: '1.9.0' });
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        'Could not mark the Welcome as done for an existing user',
        expect.any(Error),
        expect.objectContaining({ component: 'Background', previousVersion: '1.9.0' })
      );
    });
  });
});
