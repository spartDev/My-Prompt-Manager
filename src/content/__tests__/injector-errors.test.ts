import { describe, it, expect, beforeEach } from 'vitest';

import { ContentScriptInjector } from '../../background/background';
import { getChromeMock } from '../../test/mocks';

describe('ContentScriptInjector error handling', () => {
  beforeEach(() => {
    const chromeMock = getChromeMock();
    chromeMock.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com', status: 'complete' } as chrome.tabs.Tab);
    chromeMock.permissions.contains.mockResolvedValue(false);
    chromeMock.storage.local.get.mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['example.com'],
        customSites: []
      }
    });
    chromeMock.scripting.executeScript.mockResolvedValue([{ result: true }]);
  });

  it('skips injection when the site permission is missing', async () => {
    const chromeMock = getChromeMock();
    const injector = new ContentScriptInjector();

    await injector.injectIfNeeded(1);

    expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('returns a tab access denied message when execution is blocked', async () => {
    const chromeMock = getChromeMock();
    chromeMock.permissions.contains.mockResolvedValue(true);
    chromeMock.scripting.executeScript
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([{ result: { isInjected: false, orphanedElements: 0 } }])
      .mockRejectedValueOnce(new Error('tab access denied'));

    const injector = new ContentScriptInjector();
    const result = await injector.forceInjectContentScript(1);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot access this tab/i);
  });

  it('detects orphaned tabs shortly after extension reload', async () => {
    const chromeMock = getChromeMock();
    chromeMock.permissions.contains.mockResolvedValue(true);
    chromeMock.scripting.executeScript
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([{ result: { isInjected: false, orphanedElements: 0 } }])
      .mockRejectedValueOnce(new Error('tab access denied'));

    const injector = new ContentScriptInjector();
    (injector as { extensionStartTime: number }).extensionStartTime = Date.now();

    const result = await injector.forceInjectContentScript(1);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/recently reloaded/i);
  });
});
