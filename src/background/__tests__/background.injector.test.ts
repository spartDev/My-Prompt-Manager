import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';
import { ContentScriptInjector } from '../background';

describe('ContentScriptInjector integration', () => {
  beforeEach(() => {
    const chromeMock = getChromeMock() as any;
    chromeMock.storage.local.get.mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: []
      }
    });
    chromeMock.tabs.get.mockResolvedValue({
      id: 1,
      url: 'https://chatgpt.com',
      status: 'complete'
    } as chrome.tabs.Tab);
    chromeMock.permissions.contains.mockImplementation(
      async ({ origins }: chrome.permissions.Permissions) => {
        if (!origins?.[0]) {
          return false;
        }
        try {
          const url = new URL(origins[0].replace('/*', ''));
          return url.hostname === 'chatgpt.com';
        } catch {
          return false;
        }
      }
    );
    chromeMock.runtime.getManifest.mockReturnValue({ content_scripts: [{ js: ['content.js'] }] });
    chromeMock.runtime.getURL.mockImplementation((path: string) => path);
    chromeMock.scripting.executeScript.mockResolvedValue([{ result: true }]);
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({} as Response);
  });

  it('injects the content script when permissions allow it', async () => {
    const chromeMock = getChromeMock() as any;
    chromeMock.scripting.executeScript
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([{ result: { isInjected: false, orphanedElements: 0 } }])
      .mockResolvedValueOnce([]);

    const injector = new ContentScriptInjector();
    await injector.injectIfNeeded(1);

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(3);
    const lastCall = chromeMock.scripting.executeScript.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ files: expect.arrayContaining(['content.js']) });
  });

  it('does not attempt injection when permissions are denied', async () => {
    const chromeMock = getChromeMock() as any;
    chromeMock.permissions.contains.mockResolvedValue(false);

    const injector = new ContentScriptInjector();
    await injector.injectIfNeeded(1);

    expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('skips restricted URLs', async () => {
    const chromeMock = getChromeMock() as any;
    chromeMock.tabs.get.mockResolvedValue({
      id: 2,
      url: 'chrome://settings',
      status: 'complete'
    } as chrome.tabs.Tab);

    const injector = new ContentScriptInjector();
    await injector.injectIfNeeded(2);

    expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
  });

  describe('on a Custom site', () => {
    const openCustomSite = (customSites: unknown[]) => {
      const chromeMock = getChromeMock() as any;
      chromeMock.storage.local.get.mockResolvedValue({
        promptLibrarySettings: { enabledSites: [], customSites }
      });
      chromeMock.tabs.get.mockResolvedValue({
        id: 4,
        url: 'https://chat.example.com/thread',
        status: 'complete'
      } as chrome.tabs.Tab);
      chromeMock.permissions.contains.mockResolvedValue(true);
      chromeMock.scripting.executeScript
        .mockResolvedValueOnce([{ result: true }])
        .mockResolvedValueOnce([{ result: { isInjected: false, orphanedElements: 0 } }])
        .mockResolvedValueOnce([]);
      return chromeMock;
    };
    const injectedFiles = (chromeMock: any): unknown[] =>
      chromeMock.scripting.executeScript.mock.calls.filter(([options]: [{ files?: string[] }]) => options.files);

    it('injects the content script when the Custom site is on', async () => {
      const chromeMock = openCustomSite([
        { hostname: 'chat.example.com', displayName: 'Example chat', enabled: true, dateAdded: 1 }
      ]);

      await new ContentScriptInjector().injectIfNeeded(4);

      expect(injectedFiles(chromeMock)).toHaveLength(1);
    });

    it('injects nothing when the Custom site is off', async () => {
      const chromeMock = openCustomSite([
        { hostname: 'chat.example.com', displayName: 'Example chat', enabled: false, dateAdded: 1 }
      ]);

      await new ContentScriptInjector().injectIfNeeded(4);

      expect(injectedFiles(chromeMock)).toHaveLength(0);
    });

    it('injects nothing when the stored entry of the Custom site is malformed', async () => {
      // No display name and no date: the content script would find the site turned off
      const chromeMock = openCustomSite([{ hostname: 'chat.example.com', enabled: true }]);

      await new ContentScriptInjector().injectIfNeeded(4);

      expect(injectedFiles(chromeMock)).toHaveLength(0);
    });
  });

  it('clears tracking state during cleanup', () => {
    const injector = new ContentScriptInjector();
    (injector as any).injectedTabs.add(3);
    (injector as any).injectionPromises.set(3, Promise.resolve());
    (injector as any).orphanedTabs.add(3);

    injector.cleanup(3);

    const internal = injector as any;
    expect(internal.injectedTabs.has(3)).toBe(false);
    expect(internal.injectionPromises.has(3)).toBe(false);
    expect(internal.orphanedTabs.has(3)).toBe(false);
  });

  it('classifies injection errors correctly', () => {
    const injector = new ContentScriptInjector();
    const classify = injector as unknown as {
      classifyInjectionError: (error: Error, tabId: number) => string;
    };

    const scenarios: Array<[Error, string]> = [
      [new Error('No permission to inject into chatgpt.com'), 'permission'],
      [new Error('tab access denied for tab'), 'tab_access_denied'],
      [new Error('interrupted by user'), 'network'],
      [new Error('No tab with id 1'), 'tab_closed'],
      [new Error('violates CSP'), 'security'],
      [new Error('unexpected'), 'unknown']
    ];

    scenarios.forEach(([error, expected]) => {
      const result = classify.classifyInjectionError(error, 1);
      expect(result).toBe(expected);
    });
  });
});
