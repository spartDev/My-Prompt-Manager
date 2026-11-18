import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';
import { WELCOME_KEY } from '../../welcome/storage';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';

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

/**
 * The content script in the open tabs of the Platforms (My-Prompt-Manager-ojz.19, decision D1). Chrome
 * runs a manifest's content scripts only in pages loaded after the extension: a chat tab already open
 * when the extension is installed, or updated, has none until it reloads. The Welcome tells a new user
 * to type // in their AI chat, so a first install runs the pass an update runs: each open tab of a
 * Platform that is on gets the content script, with no reload.
 */
describe('background: the content script in the open tabs of the Platforms, on install and on update', () => {
  const CLAUDE_TAB = { id: 7, url: 'https://claude.ai/new', status: 'complete' } as chrome.tabs.Tab;
  const CHATGPT_TAB = { id: 8, url: 'https://chatgpt.com/', status: 'complete' } as chrome.tabs.Tab;
  const OTHER_SITE_TAB = { id: 9, url: 'https://example.com/', status: 'complete' } as chrome.tabs.Tab;
  const BROWSER_TAB = { id: 10, url: 'chrome://newtab/', status: 'complete' } as chrome.tabs.Tab;
  const NO_URL_TAB = { id: 11, status: 'complete' } as chrome.tabs.Tab;
  const INSTALL = { reason: 'install' } as const;

  /** The tabs Chrome has open; every host permission of the manifest granted, as an install grants them */
  const openTabs = (tabs: chrome.tabs.Tab[]): void => {
    vi.mocked(chrome.tabs.query).mockResolvedValue(tabs as never);
    vi.mocked(chrome.tabs.get).mockImplementation((async (tabId: number) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      if (!tab) {
        throw new Error(`No tab with id: ${String(tabId)}`);
      }
      return tab;
    }) as never);
    vi.mocked(chrome.permissions.contains).mockResolvedValue(true as never);
    // A function runs in the page (here, the test's document): no content script there yet
    vi.mocked(chrome.scripting.executeScript).mockImplementation((async (injection: { func?: () => unknown }) =>
      [{ result: injection.func ? injection.func() : undefined }]) as never);
  };

  /** The tabs that got the content script's file */
  const injectedTabs = (): number[] =>
    vi
      .mocked(chrome.scripting.executeScript)
      .mock.calls.filter(([injection]) => 'files' in injection)
      .map(([injection]) => injection.target.tabId);

  it.each([
    ['install', INSTALL],
    ['update', UPDATE]
  ] as const)("'%s' gives the content script to each open tab of a Platform that is on, and to no other tab", async (_reason, details) => {
    openTabs([CLAUDE_TAB, OTHER_SITE_TAB, CHATGPT_TAB, BROWSER_TAB, NO_URL_TAB]);
    const { onInstalled } = await loadBackground();

    onInstalled(details);

    await vi.waitFor(() => {
      expect(injectedTabs()).toEqual([CLAUDE_TAB.id, CHATGPT_TAB.id]);
    });
    expect(vi.mocked(chrome.scripting.executeScript)).toHaveBeenCalledWith({ target: { tabId: CLAUDE_TAB.id }, files: ['content.js'] });
  });

  it("'install' leaves out a Platform the user turned off, as 'update' does", async () => {
    await chrome.storage.local.set({ promptLibrarySettings: { platformChoices: { 'chatgpt.com': false }, customSites: [] } });
    openTabs([CLAUDE_TAB, CHATGPT_TAB]);
    const { onInstalled } = await loadBackground();

    onInstalled(INSTALL);

    await vi.waitFor(() => {
      expect(injectedTabs()).toEqual([CLAUDE_TAB.id]);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(injectedTabs()).toEqual([CLAUDE_TAB.id]);
  });

  it("'install' leaves a tab that already has the content script as it is", async () => {
    openTabs([CLAUDE_TAB]);
    (window as { __promptLibraryInjected?: boolean }).__promptLibraryInjected = true;
    try {
      const { onInstalled } = await loadBackground();

      onInstalled(INSTALL);

      await vi.waitFor(() => {
        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(injectedTabs()).toEqual([]);
    } finally {
      delete (window as { __promptLibraryInjected?: boolean }).__promptLibraryInjected;
    }
  });

  it("is harmless on a fresh install: no Site settings and no icon placement stored, no tab on a Platform; it writes nothing but the install's records", async () => {
    openTabs([OTHER_SITE_TAB, BROWSER_TAB, NO_URL_TAB]);
    const { onInstalled, Logger } = await loadBackground();

    onInstalled(INSTALL);

    await vi.waitFor(async () => {
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
      expect(Object.keys(await chrome.storage.local.get(null)).sort()).toEqual([WELCOME_KEY, WHATS_NEW_KEY].sort());
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(injectedTabs()).toEqual([]);
    expect(Object.keys(await chrome.storage.local.get(null)).sort()).toEqual([WELCOME_KEY, WHATS_NEW_KEY].sort());
    expect(chrome.storage.session.set).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
    expect(Logger.warn).not.toHaveBeenCalled();
  });

  it("'install' with no tab open at all reads the tabs once and does nothing more", async () => {
    openTabs([]);
    const { onInstalled, Logger } = await loadBackground();

    onInstalled(INSTALL);

    await vi.waitFor(() => {
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("a failure of the pass on 'install' is logged, never thrown, and the install's records are still written", async () => {
    vi.mocked(chrome.tabs.query).mockRejectedValue(new Error('tabs unavailable') as never);
    const { onInstalled, Logger } = await loadBackground();

    expect(() => {
      onInstalled(INSTALL);
    }).not.toThrow();

    await vi.waitFor(async () => {
      expect(Logger.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'tabs unavailable' }), expect.objectContaining({ component: 'Background' }));
      expect((await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'pending', step: 0 });
    });
  });

  it.each([
    { reason: 'chrome_update' },
    { reason: 'shared_module_update', id: 'shared-module-id' }
  ] as const)('runs no pass when the reason is $reason', async (details) => {
    openTabs([CLAUDE_TAB]);
    const { onInstalled } = await loadBackground();

    onInstalled(details);

    await vi.waitFor(() => {
      expect(chrome.action.setPopup).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
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
    // A recorded Release of install and a Welcome record: the update writes to neither, so the one failed write is the cleaning's
    await chrome.storage.local.set({
      prompts: [dirtyPrompt],
      categories: [dirtyCategory],
      [WHATS_NEW_KEY]: { installedVersion: '1.0.0' },
      [WELCOME_KEY]: { status: 'done' }
    });
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
