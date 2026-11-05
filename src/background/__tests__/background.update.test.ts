import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

type InstalledListener = (details: chrome.runtime.InstalledDetails) => void;
type StartupListener = () => void;

/**
 * Loads the background script afresh and returns the listeners it registered for
 * chrome.runtime.onInstalled and chrome.runtime.onStartup, plus the Logger that fresh copy of the script uses.
 */
async function loadBackground(): Promise<{
  onInstalled: InstalledListener;
  onStartup: StartupListener;
  Logger: typeof import('../../utils/logger');
}> {
  vi.resetModules();

  const addInstalled = vi.mocked(getChromeMock().runtime.onInstalled.addListener);
  const addStartup = vi.mocked(getChromeMock().runtime.onStartup.addListener);
  addInstalled.mockClear();
  addStartup.mockClear();

  await import('../background');
  const Logger = await import('../../utils/logger');

  const onInstalled = addInstalled.mock.calls[addInstalled.mock.calls.length - 1]?.[0];
  if (!onInstalled) {
    throw new Error('The background script did not register a chrome.runtime.onInstalled listener');
  }
  const startupListeners = addStartup.mock.calls.map(([listener]) => listener as StartupListener);
  const onStartup: StartupListener = () => {
    for (const listener of startupListeners) {
      listener();
    }
  };

  return { onInstalled, onStartup, Logger };
}

const storedPrompts = async (): Promise<unknown> => (await chrome.storage.local.get('prompts')).prompts;
const storedCategories = async (): Promise<unknown> => (await chrome.storage.local.get('categories')).categories;


/** chrome.runtime.onInstalled details for an update (previousVersion is required with that reason). */
const UPDATE = { reason: 'update', previousVersion: '1.0.0' } as const;

describe('background: stored data on extension update', () => {
  const entry = {
    id: 'p1',
    title: 'Title',
    content: 'Body',
    category: 'Work',
    createdAt: 1,
    updatedAt: 2,
    usageCount: 0,
    lastUsedAt: 1
  };
  const dirtyPrompt = { ...entry, title: 'Ti\u{200B}tle', content: 'Bo\u{202E}dy' };
  const dirtyCategory = { id: 'c1', name: 'Wo\u{200B}rk' };

  beforeEach(async () => {
    await chrome.storage.local.set({ prompts: [dirtyPrompt], categories: [dirtyCategory] });
    vi.mocked(chrome.storage.local.set).mockClear();
  });

  it('cleans stored Prompts and Category names of Hidden characters when the extension is updated', async () => {
    const { onInstalled } = await loadBackground();

    onInstalled(UPDATE);

    await vi.waitFor(async () => {
      expect(await storedPrompts()).toEqual([entry]);
      expect(await storedCategories()).toEqual([{ id: 'c1', name: 'Work' }]);
    });
  });

  it.each([
    { reason: 'install' },
    { reason: 'chrome_update' },
    { reason: 'shared_module_update', id: 'shared-module-id' }
  ] as const)(
    'leaves stored data alone when the reason is $reason',
    async (details) => {
      const { onInstalled } = await loadBackground();

      onInstalled(details);

      await vi.waitFor(() => {
        expect(chrome.action.setPopup).toHaveBeenCalled();
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await storedPrompts()).toEqual([dirtyPrompt]);
      expect(await storedCategories()).toEqual([dirtyCategory]);
    }
  );

  it('logs a failure instead of throwing, and still re-injects the content scripts', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_EXCEEDED'));
    const { onInstalled, Logger } = await loadBackground();

    expect(() => {
      onInstalled(UPDATE);
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('stored data'),
        expect.objectContaining({ type: 'STORAGE_QUOTA_EXCEEDED' }),
        expect.objectContaining({ component: 'Background' })
      );
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });
  });

  it('does not make the re-injection wait for the cleaning', async () => {
    vi.mocked(chrome.storage.local.set).mockImplementation(() => new Promise<void>(() => undefined));
    const { onInstalled } = await loadBackground();

    onInstalled(UPDATE);

    await vi.waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });
  });
});

describe('background: stored data on browser startup', () => {
  const entry = {
    id: 'p1',
    title: 'Title',
    content: 'Body',
    category: 'Work',
    createdAt: 1,
    updatedAt: 2,
    usageCount: 0,
    lastUsedAt: 1
  };
  const dirtyPrompt = { ...entry, title: 'Ti\u{200B}tle', content: 'Bo\u{202E}dy' };
  const dirtyCategory = { id: 'c1', name: 'Wo\u{200B}rk' };

  it('cleans at the next browser startup the Hidden characters that a failed update pass left', async () => {
    await chrome.storage.local.set({ prompts: [dirtyPrompt], categories: [dirtyCategory] });
    vi.mocked(chrome.storage.local.set).mockClear();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));
    const { onInstalled, onStartup, Logger } = await loadBackground();

    onInstalled(UPDATE);
    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('stored data'),
        expect.anything(),
        expect.objectContaining({ component: 'Background' })
      );
    });
    expect(await storedPrompts()).toEqual([dirtyPrompt]);

    onStartup();

    await vi.waitFor(async () => {
      expect(await storedPrompts()).toEqual([entry]);
      expect(await storedCategories()).toEqual([{ id: 'c1', name: 'Work' }]);
    });
  });

  it('writes nothing at startup when the Library is already clean', async () => {
    await chrome.storage.local.set({ prompts: [entry], categories: [{ id: 'c1', name: 'Work' }] });
    vi.mocked(chrome.storage.local.set).mockClear();
    const { onStartup } = await loadBackground();

    onStartup();

    await vi.waitFor(() => {
      expect(chrome.action.setPopup).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
