import { describe, it, expect, beforeEach, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

type InstalledListener = (details: chrome.runtime.InstalledDetails) => void;

/**
 * Loads the background script afresh and returns the listener it registered for
 * chrome.runtime.onInstalled, plus the Logger that fresh copy of the script uses.
 */
async function loadBackground(): Promise<{ onInstalled: InstalledListener; Logger: typeof import('../../utils/logger') }> {
  vi.resetModules();

  const addListener = vi.mocked(getChromeMock().runtime.onInstalled.addListener);
  addListener.mockClear();

  await import('../background');
  const Logger = await import('../../utils/logger');

  const onInstalled = addListener.mock.calls[addListener.mock.calls.length - 1]?.[0];
  if (!onInstalled) {
    throw new Error('The background script did not register a chrome.runtime.onInstalled listener');
  }

  return { onInstalled, Logger };
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
