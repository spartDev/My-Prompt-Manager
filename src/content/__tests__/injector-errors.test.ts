import { describe, it, expect, beforeEach, Mock } from 'vitest';

import { ContentScriptInjector } from '../../entrypoints/background';
import { getChromeMockFunctions } from '../../test/mocks';

describe('ContentScriptInjector error handling', () => {
  beforeEach(() => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.tabs.get as Mock).mockResolvedValue({ id: 1, url: 'https://example.com', status: 'complete' } as chrome.tabs.Tab);
    (chromeMock.permissions.contains as Mock).mockResolvedValue(false);
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['example.com'],
        customSites: []
      }
    });
    ((chromeMock.scripting.executeScript as Mock)).mockResolvedValue([{ result: true }]);
  });

  it('skips injection when the site permission is missing', async () => {
    const chromeMock = getChromeMockFunctions();
    const injector = new ContentScriptInjector();

    await injector.injectIfNeeded(1);

    expect((chromeMock.scripting.executeScript)).not.toHaveBeenCalled();
  });

  it('returns a tab access denied message when execution is blocked', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.permissions.contains as Mock).mockResolvedValue(true);
    (chromeMock.scripting.executeScript as Mock)
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([{ result: { isInjected: false, orphanedElements: 0 } }])
      .mockRejectedValueOnce(new Error('tab access denied'));

    const injector = new ContentScriptInjector();
    const result = await injector.forceInjectContentScript(1);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot access this tab/i);
  });

  it('detects orphaned tabs shortly after extension reload', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.permissions.contains as Mock).mockResolvedValue(true);
    (chromeMock.scripting.executeScript as Mock)
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([{ result: { isInjected: false, orphanedElements: 0 } }])
      .mockRejectedValueOnce(new Error('tab access denied'));

    const injector = new ContentScriptInjector();
    (injector as any).extensionStartTime = Date.now();

    const result = await injector.forceInjectContentScript(1);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/recently reloaded/i);
  });
});
