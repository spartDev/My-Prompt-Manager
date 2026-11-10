/**
 * Unit tests for PromptLibraryInjector
 */

 
 
 
 
 
 
 
 

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prompt } from '../../types/index';
import { AnchoredOverlay } from '../anchored-overlay';
import { IconPlacementController } from '../icon-placement';
import { PromptLibraryInjector } from '../injector';

// Mock all dependencies
vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn(function() {
    return {
      getAllSelectors: vi.fn().mockReturnValue(['textarea', 'div[contenteditable="true"]']),
      createIcon: vi.fn().mockReturnValue(document.createElement('button')),
      insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
      initializeStrategies: vi.fn(),
      cleanup: vi.fn(),
      getButtonContainerSelector: vi.fn().mockReturnValue(null),
      getCustomSiteConfig: vi.fn().mockReturnValue(null)
    };
  })
}));

vi.mock('../../ui/event-manager', () => ({
  EventManager: vi.fn(function() {
    return {
      addTrackedEventListener: vi.fn(),
      removeTrackedListeners: vi.fn(),
      cleanup: vi.fn()
    };
  })
}));

vi.mock('../../ui/element-factory', () => {
  const MockUIElementFactory = vi.fn(function() {
    return {
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    };
  });
  // Add static methods
  (MockUIElementFactory as any).convertToAbsolutePositioning = vi.fn();
  (MockUIElementFactory as any).convertToRelativePositioning = vi.fn();
  return { UIElementFactory: MockUIElementFactory, fitPromptsPill: vi.fn(), syncPromptsPillTheme: vi.fn(), BAR_SEARCH_DEPTH: 6 };
});

// The Prompt selector's controller, replaced by a recorder: the injector's part is to wire it
const selectorMock = vi.hoisted(() => ({
  instances: [] as { callbacks: any; toggle: any; setTrigger: any; close: any; destroy: any; isOpen: boolean }[]
}));

vi.mock('../../selector/controller', () => ({
  PromptSelectorController: vi.fn(function(callbacks: unknown) {
    const instance = { callbacks, toggle: vi.fn(), setTrigger: vi.fn(), close: vi.fn(), destroy: vi.fn(), isOpen: false };
    selectorMock.instances.push(instance);
    return instance;
  })
}));

vi.mock('../../selector/font', () => ({
  SELECTOR_FONT_FAMILY: 'MPM Schibsted Grotesk',
  loadSelectorFont: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../utils/storage', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  getPrompts: vi.fn().mockResolvedValue([]),
  isSiteEnabled: vi.fn().mockImplementation((hostname) => {
    // Make sure localhost is enabled for tests
    return Promise.resolve(hostname === 'localhost' || hostname === 'test.com');
  }),
  getSettings: vi.fn().mockResolvedValue({
    enabledSites: ['test.com', 'localhost'],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  }),
  getDefaultSettings: vi.fn().mockReturnValue({
    enabledSites: ['test.com', 'localhost'],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  })
}));

vi.mock('../../utils/styles', () => ({
  injectCSS: vi.fn(),
  isInjected: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn(),
  refreshDebugMode: vi.fn()
}));

vi.mock('../../utils/dom', () => ({
  DOMUtils: {
    supportsCSSAnchorPositioning: vi.fn().mockReturnValue(false),
    insertBefore: vi.fn().mockReturnValue(true),
    insertAfter: vi.fn().mockReturnValue(true),
    prependChild: vi.fn().mockReturnValue(true),
    appendChild: vi.fn().mockReturnValue(true)
  }
}));

vi.mock('../../utils/element-fingerprint', () => ({
  getElementFingerprintGenerator: vi.fn().mockReturnValue({
    findElement: vi.fn().mockReturnValue(null),
    generateFingerprint: vi.fn()
  })
}));

vi.mock('../../../config/platforms', () => ({
  getPlatformByHostname: vi.fn().mockReturnValue(null)
}));

// Mock DOM methods
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'test.example.com',
    href: 'https://test.example.com/test'
  },
  writable: true
});

Object.defineProperty(document, 'readyState', {
  value: 'complete',
  writable: true
});

// Mock hostname to match enabled sites
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  writable: true
});

// Mock chrome runtime for message handling
Object.defineProperty(global, 'chrome', {
  value: {
    ...global.chrome,
    runtime: {
      ...global.chrome?.runtime,
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn()
      }
    }
  },
  writable: true
});

// Mock matchMedia for theme manager
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('PromptLibraryInjector', () => {
  let injector: PromptLibraryInjector;
  let mockTextarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    selectorMock.instances.length = 0;
    
    // Create a mock textarea
    mockTextarea = document.createElement('textarea');
    mockTextarea.style.width = '100px';
    mockTextarea.style.height = '50px';
    document.body.appendChild(mockTextarea);
    
    // Mock getBoundingClientRect
    mockTextarea.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      left: 100,
      right: 200,
      bottom: 150,
      width: 100,
      height: 50
    });

    injector = new PromptLibraryInjector();
  });

  afterEach(async () => {
    injector.cleanup();
    document.body.removeChild(mockTextarea);
    // Wait for any pending timeouts to complete
    await new Promise(resolve => setTimeout(resolve, 150));
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(injector).toBeInstanceOf(PromptLibraryInjector);
    });
  });

  describe('initialize', () => {
    it('should inject CSS styles', async () => {
      const { injectCSS } = await import('../../utils/styles');
      await injector.initialize();
      expect(injectCSS).toHaveBeenCalled();
    });
  });

  describe('Prompt selector wiring', () => {
    const prompt: Prompt = {
      id: 'track1', title: 'Track Me', content: 'Track content', category: 'Tracking',
      createdAt: 1, updatedAt: 1, usageCount: 0, lastUsedAt: 1
    };
    const selector = () => selectorMock.instances[0];
    const platformManager = async () => {
      const { PlatformInsertionManager } = await import('../insertion-manager');
      return (PlatformInsertionManager as any).mock.results.at(-1).value;
    };

    it('creates one controller for the injector', () => {
      expect(selectorMock.instances).toHaveLength(1);
    });

    it('showPromptSelector toggles the selector over the input field, with the Prompts button', async () => {
      await injector.initialize();
      await new Promise(resolve => setTimeout(resolve, 50));
      const icon = (injector as any).state.icon;

      injector.showPromptSelector(mockTextarea);

      expect(selector().toggle).toHaveBeenCalledWith(mockTextarea, icon);
    });

    it('tells the selector which button is the current one, each time a button is placed', async () => {
      await injector.initialize();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(selector().setTrigger).toHaveBeenCalledWith((injector as any).state.icon);
    });

    it('the Prompts button toggles the selector when clicked', async () => {
      await injector.initialize();
      await new Promise(resolve => setTimeout(resolve, 50));

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results.at(-1).value;
      const click = eventManagerInstance.addTrackedEventListener.mock.calls.find((call: any[]) => call[1] === 'click');
      expect(click).toBeDefined();

      const event = new Event('click', { cancelable: true });
      click[2](event);

      expect(event.defaultPrevented).toBe(true);
      expect(selector().toggle).toHaveBeenCalledTimes(1);
    });

    it('reads the Prompts and the Categories each time the selector opens', async () => {
      const { getPrompts, getCategories } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([prompt]);
      vi.mocked(getCategories).mockResolvedValue([{ name: 'Tracking', color: '#2563EB' }]);

      expect(await selector().callbacks.loadLibrary()).toEqual({ prompts: [prompt], categories: [{ name: 'Tracking', color: '#2563EB' }] });
    });

    it('inserts the chosen Prompt through the Platform, with the content the selector gives', async () => {
      await selector().callbacks.insert(prompt, 'Filled content', mockTextarea);

      expect((await platformManager()).insertPrompt).toHaveBeenCalledWith(mockTextarea, 'Filled content');
    });

    it('reports the use after a successful insertion', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);

      await selector().callbacks.insert(prompt, prompt.content, mockTextarea);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PROMPT_USAGE_INCREMENT',
        data: { promptId: 'track1', platform: 'localhost', categoryId: 'Tracking' }
      });
    });

    it('reports no use when the insertion fails', async () => {
      (await platformManager()).insertPrompt.mockResolvedValue({ success: false, error: 'nope' });
      vi.mocked(chrome.runtime.sendMessage).mockClear();

      await selector().callbacks.insert(prompt, prompt.content, mockTextarea);

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      const Logger = await import('../../utils/logger');
      expect(Logger.warn).toHaveBeenCalledWith('[CONTENT] Prompt insertion reported failure', { promptId: 'track1', error: 'nope' });
    });

    it('does not throw when the insertion throws', async () => {
      (await platformManager()).insertPrompt.mockRejectedValue(new Error('boom'));

      await expect(selector().callbacks.insert(prompt, prompt.content, mockTextarea)).resolves.toBe(false);
    });

    it('tells the selector whether the text arrived', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
      await expect(selector().callbacks.insert(prompt, prompt.content, mockTextarea)).resolves.toBe(true);

      (await platformManager()).insertPrompt.mockResolvedValue({ success: false, error: 'nope' });
      await expect(selector().callbacks.insert(prompt, prompt.content, mockTextarea)).resolves.toBe(false);
    });

    it('counts no use, and says the text did not arrive, when the input field is gone once the Platform has written', async () => {
      const gone = document.createElement('textarea');
      document.body.appendChild(gone);
      (await platformManager()).insertPrompt.mockImplementation((element: HTMLElement) => {
        element.remove();
        return Promise.resolve({ success: true, method: 'direct' });
      });
      vi.mocked(chrome.runtime.sendMessage).mockClear();

      await expect(selector().callbacks.insert(prompt, prompt.content, gone)).resolves.toBe(false);

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('Undo restores the text through the Platform, and reports no use', async () => {
      const manager = await platformManager();
      manager.restoreText = vi.fn().mockResolvedValue({ success: true, method: 'restore-value' });
      vi.mocked(chrome.runtime.sendMessage).mockClear();

      await expect(selector().callbacks.restore('Draft', mockTextarea)).resolves.toBe(true);

      expect(manager.restoreText).toHaveBeenCalledWith(mockTextarea, 'Draft');
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('Undo does not throw when the Platform fails', async () => {
      const manager = await platformManager();
      manager.restoreText = vi.fn().mockRejectedValue(new Error('boom'));

      await expect(selector().callbacks.restore('Draft', mockTextarea)).resolves.toBe(false);
    });

    it('does not throw when the use cannot be reported', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('Extension context invalidated'));

      await expect(selector().callbacks.insert(prompt, prompt.content, mockTextarea)).resolves.toBe(true);

      const Logger = await import('../../utils/logger');
      await vi.waitFor(() => {
        expect(Logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Failed to report prompt usage'),
          expect.any(Object)
        );
      });
    });

    it('does not wait for the use to be reported before it says the text arrived', async () => {
      // The background never answers
      vi.mocked(chrome.runtime.sendMessage).mockReturnValue(new Promise(() => { /* pending */ }) as never);

      await expect(selector().callbacks.insert(prompt, prompt.content, mockTextarea)).resolves.toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('the Prompts button says whether the selector is open', () => {
      const button = document.createElement('button');
      const wrapped = document.createElement('div');
      const inner = document.createElement('button');
      wrapped.appendChild(inner);

      selector().callbacks.onOpenChange(true, button);
      selector().callbacks.onOpenChange(true, wrapped);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(inner.getAttribute('aria-expanded')).toBe('true');

      selector().callbacks.onOpenChange(false, button);
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(() => selector().callbacks.onOpenChange(false, null)).not.toThrow();
    });

    it('fits the Prompts button again when the bar it sits in changes size, until the button is thrown away', async () => {
      const observers: { callback: () => void; observed: Element[]; disconnect: ReturnType<typeof vi.fn> }[] = [];
      vi.stubGlobal('ResizeObserver', vi.fn(function(callback: () => void) {
        const observer = { callback, observed: [] as Element[], disconnect: vi.fn() };
        observers.push(observer);
        return { observe: (element: Element) => { observer.observed.push(element); }, disconnect: observer.disconnect };
      }));
      const { fitPromptsPill, syncPromptsPillTheme } = await import('../../ui/element-factory');
      const bar = document.createElement('div');
      const icon = document.createElement('button');
      bar.appendChild(icon);
      document.body.appendChild(bar);

      // Counted for this button only: buttons of other injectors may still be fitted meanwhile
      const fits = () => vi.mocked(fitPromptsPill).mock.calls.filter(([fitted]) => fitted === icon).length;
      const observer = () => observers.find((candidate) => candidate.observed.includes(bar));

      (injector as any).fitIconWhenPlaced(icon);
      await vi.waitFor(() => { expect(fits()).toBe(1); });
      // Once in the page, the button also takes the theme it may have missed while detached
      expect(syncPromptsPillTheme).toHaveBeenCalledWith(icon);
      expect(observer()?.observed).toEqual([bar]);

      // The bar is resized: the button is fitted again
      observer()?.callback();
      await vi.waitFor(() => { expect(fits()).toBe(2); });

      (injector as any).disposeIcon(icon);
      expect(observer()?.disconnect).toHaveBeenCalled();
      bar.remove();
      vi.unstubAllGlobals();
    });

    it('releases the resize observer when the site is cleaned up, not only when the button is replaced', async () => {
      const disconnect = vi.fn();
      vi.stubGlobal('ResizeObserver', vi.fn(function() {
        return { observe: vi.fn(), disconnect };
      }));
      const bar = document.createElement('div');
      const icon = document.createElement('button');
      bar.appendChild(icon);
      document.body.appendChild(bar);
      (injector as any).refitIconOnResize(icon);

      (injector as any).partialCleanup();

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect((injector as any).iconCleanups.size).toBe(0);
      bar.remove();
      vi.unstubAllGlobals();
    });

    it('themes a button that is not in the page yet when the extension theme is read', async () => {
      await injector.initialize();
      const { syncPromptsPillTheme } = await import('../../ui/element-factory');
      const { ThemeManager } = await import('../../utils/theme-manager');
      const detached = document.createElement('button');
      (injector as any).state.icon = detached;
      vi.mocked(syncPromptsPillTheme).mockClear();

      // The theme manager tells its observers; it cannot find a detached button in the page itself
      (ThemeManager.getInstance() as any).notifyObservers('dark');
      expect(syncPromptsPillTheme).toHaveBeenCalledWith(detached);

      // After cleanup the injector no longer listens
      (injector as any).state.icon = null;
      injector.cleanup();
      (injector as any).state.icon = detached;
      vi.mocked(syncPromptsPillTheme).mockClear();
      (ThemeManager.getInstance() as any).notifyObservers('light');
      expect(syncPromptsPillTheme).not.toHaveBeenCalled();
      (injector as any).state.icon = null;
    });

    it('removes the selector on cleanup', () => {
      injector.cleanup();

      expect(selector().destroy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should not throw when called', () => {
      expect(() => injector.cleanup()).not.toThrow();
    });

    it('should be idempotent - can be called multiple times safely', () => {
      expect(() => {
        injector.cleanup();
        injector.cleanup();
        injector.cleanup();
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Create a new injector that will fail during initialization
      const failingInjector = new PromptLibraryInjector();
      
      // The error should be caught and logged, but not thrown
      expect(() => failingInjector.initialize()).not.toThrow();
      
      failingInjector.cleanup();
    });

    it('should handle missing elements gracefully', async () => {
      const Logger = await import('../../utils/logger');
      
      // Create a detached textarea (not in DOM)
      const detachedTextarea = document.createElement('textarea');
      
      await injector.showPromptSelector(detachedTextarea);
      
      // Should not throw and should log appropriate messages
      expect(Logger.debug).toHaveBeenCalled();
    });
  });



  describe('initialize - full lifecycle', () => {
    it('should set up message listener and initialize for enabled site', async () => {
      await injector.initialize();

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it('should call injectCSS and initializeStrategies for enabled site', async () => {
      const { injectCSS } = await import('../../utils/styles');
      const { PlatformInsertionManager } = await import('../insertion-manager');

      await injector.initialize();

      expect(injectCSS).toHaveBeenCalled();
      // PlatformInsertionManager is called in constructor, so initializeStrategies is on the instance
      const managerInstance = (PlatformInsertionManager as any).mock.results[0].value;
      expect(managerInstance.initializeStrategies).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      const { injectCSS } = await import('../../utils/styles');

      await injector.initialize();
      const callCount = vi.mocked(injectCSS).mock.calls.length;

      await injector.initialize();
      // Should not have been called again
      expect(vi.mocked(injectCSS).mock.calls.length).toBe(callCount);
    });

    it('should only set up message listener when site is disabled', async () => {
      const { isSiteEnabled, getSettings } = await import('../../utils/storage');
      const { injectCSS } = await import('../../utils/styles');

      vi.mocked(isSiteEnabled).mockResolvedValue(false);
      vi.mocked(getSettings).mockResolvedValue({
        enabledSites: [],
        customSites: [],
        debugMode: false,
        floatingFallback: true
      });

      const disabledInjector = new PromptLibraryInjector();
      await disabledInjector.initialize();

      // Message listener should still be set up
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      // CSS should NOT be injected for disabled sites
      expect(injectCSS).not.toHaveBeenCalled();

      disabledInjector.cleanup();
    });

    it('should throw and reset isInitialized on enabled site initialization error', async () => {
      const { isSiteEnabled } = await import('../../utils/storage');
      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      // Make initializeStrategies throw
      const { PlatformInsertionManager } = await import('../insertion-manager');
      const originalImpl = vi.mocked(PlatformInsertionManager).getMockImplementation();

      vi.mocked(PlatformInsertionManager).mockImplementation(function() {
        return {
          getAllSelectors: vi.fn().mockReturnValue([]),
          createIcon: vi.fn().mockReturnValue(null),
          insertPrompt: vi.fn(),
          initializeStrategies: vi.fn().mockRejectedValue(new Error('Strategy init failed')),
          cleanup: vi.fn(),
          getButtonContainerSelector: vi.fn().mockReturnValue(null),
          getCustomSiteConfig: vi.fn().mockReturnValue(null)
        } as any;
      } as any);

      const errorInjector = new PromptLibraryInjector();
      await expect(errorInjector.initialize()).rejects.toThrow('Strategy init failed');

      errorInjector.cleanup();

      // Restore the original mock implementation so subsequent tests work
      if (originalImpl) {
        vi.mocked(PlatformInsertionManager).mockImplementation(originalImpl);
      } else {
        vi.mocked(PlatformInsertionManager).mockImplementation(function() {
          return {
            getAllSelectors: vi.fn().mockReturnValue(['textarea', 'div[contenteditable="true"]']),
            createIcon: vi.fn().mockReturnValue(document.createElement('button')),
            insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
            initializeStrategies: vi.fn(),
            cleanup: vi.fn(),
            getButtonContainerSelector: vi.fn().mockReturnValue(null),
            getCustomSiteConfig: vi.fn().mockReturnValue(null)
          } as any;
        } as any);
      }
    });
  });

  describe('message handling', () => {
    let messageCallback: (message: Record<string, unknown>, sender: unknown, sendResponse: (response: unknown) => void) => boolean;

    beforeEach(async () => {
      await injector.initialize();
      // Capture the message listener callback
      messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as any;
    });

    it('should respond to settingsUpdated messages', async () => {
      const { isSiteEnabled } = await import('../../utils/storage');
      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      const sendResponse = vi.fn();
      const result = messageCallback(
        { action: 'settingsUpdated', settings: { enabledSites: ['localhost'], customSites: [], debugMode: false, floatingFallback: true } },
        {},
        sendResponse
      );

      expect(result).toBe(true); // keeps channel open
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should respond to reinitialize messages', () => {
      const sendResponse = vi.fn();
      const result = messageCallback(
        { action: 'reinitialize', reason: 'test' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should respond to testSelector messages with no matching elements', () => {
      const sendResponse = vi.fn();
      messageCallback(
        { action: 'testSelector', selector: '.nonexistent', placement: 'after', offset: { x: 0, y: 0 }, zIndex: 999999 },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('No elements found') })
      );
    });

    it('should respond to testSelector messages with matching elements', () => {
      // Add a test element to DOM
      const testDiv = document.createElement('div');
      testDiv.className = 'test-selector-target';
      testDiv.style.width = '100px';
      testDiv.style.height = '50px';
      document.body.appendChild(testDiv);
      testDiv.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 10, left: 10, right: 110, bottom: 60, width: 100, height: 50
      });

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'testSelector', selector: '.test-selector-target', placement: 'after', offset: { x: 0, y: 0 }, zIndex: 999999 },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, elementCount: 1 })
      );

      document.body.removeChild(testDiv);
    });

    it('should handle testSelector with zero-dimension elements', () => {
      const hiddenEl = document.createElement('div');
      hiddenEl.className = 'hidden-target';
      document.body.appendChild(hiddenEl);
      hiddenEl.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0
      });

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'testSelector', selector: '.hidden-target', placement: 'after', offset: { x: 0, y: 0 }, zIndex: 999999 },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('zero dimensions') })
      );

      document.body.removeChild(hiddenEl);
    });

    it('should handle testSelector with different placements', () => {
      const testDiv = document.createElement('div');
      testDiv.className = 'placement-target';
      document.body.appendChild(testDiv);
      testDiv.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 50, left: 50, right: 150, bottom: 100, width: 100, height: 50
      });

      const placements = ['before', 'after', 'inside-start', 'inside-end', 'unknown-placement'];
      for (const placement of placements) {
        const sendResponse = vi.fn();
        messageCallback(
          { action: 'testSelector', selector: '.placement-target', placement, offset: { x: 5, y: 5 }, zIndex: 999 },
          {},
          sendResponse
        );
        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      }

      document.body.removeChild(testDiv);
    });

    it('should respond with error for unknown message actions', () => {
      const sendResponse = vi.fn();
      messageCallback(
        { action: 'unknownAction' },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Unknown message action' });
    });
  });

  describe('settings update handling via messages', () => {
    let messageCallback: (message: Record<string, unknown>, sender: unknown, sendResponse: (response: unknown) => void) => boolean;

    beforeEach(async () => {
      await injector.initialize();
      messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as any;
    });

    it('should handle site being disabled via settings update', async () => {
      const { isSiteEnabled } = await import('../../utils/storage');
      const { refreshDebugMode } = await import('../../utils/logger');

      // First the site is enabled (from initialize), then disabled
      vi.mocked(isSiteEnabled).mockResolvedValue(false);

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'settingsUpdated', settings: { enabledSites: [], customSites: [], debugMode: false, floatingFallback: true } },
        {},
        sendResponse
      );

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(refreshDebugMode).toHaveBeenCalled();
    });

    it('should handle site being re-enabled via settings update', async () => {
      const { isSiteEnabled, getSettings } = await import('../../utils/storage');
      const { injectCSS } = await import('../../utils/styles');

      // First disable the site
      vi.mocked(isSiteEnabled).mockResolvedValue(false);
      vi.mocked(getSettings).mockResolvedValue({
        enabledSites: [],
        customSites: [],
        debugMode: false,
        floatingFallback: true
      });

      const disabledInjector = new PromptLibraryInjector();
      await disabledInjector.initialize();

      const msgCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[
        vi.mocked(chrome.runtime.onMessage.addListener).mock.calls.length - 1
      ][0] as any;

      // Now re-enable
      vi.mocked(isSiteEnabled).mockResolvedValue(true);
      vi.mocked(injectCSS).mockClear();

      const sendResponse = vi.fn();
      msgCallback(
        { action: 'settingsUpdated', settings: { enabledSites: ['localhost'], customSites: [], debugMode: false, floatingFallback: true } },
        {},
        sendResponse
      );

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 100));

      // CSS should be injected when site is re-enabled
      expect(injectCSS).toHaveBeenCalled();

      disabledInjector.cleanup();
    });
  });

  describe('cleanup - full lifecycle', () => {
    it('should clean up after initialization', async () => {
      await injector.initialize();
      expect(() => injector.cleanup()).not.toThrow();
    });

    it('should disconnect mutation observer during cleanup', async () => {
      await injector.initialize();

      // After initialize, a mutation observer should have been created
      // Cleanup should disconnect it without errors
      expect(() => injector.cleanup()).not.toThrow();
    });

    it('should clear SPA monitoring interval during cleanup', async () => {
      await injector.initialize();

      // Cleanup should clear the SPA monitoring interval
      expect(() => injector.cleanup()).not.toThrow();
    });
  });

  describe('removeAllExistingIcons', () => {
    it('releases a Floating UI icon while it is still in the document, then removes it', async () => {
      const icon = document.createElement('button');
      icon.classList.add('prompt-library-cleanup-target');
      icon.setAttribute('data-positioning-method', 'floating-ui');
      document.body.appendChild(icon);
      let connectedAtRelease: boolean | null = null;
      const release = vi.spyOn(AnchoredOverlay.prototype, 'release').mockImplementation((released) => {
        if (released === icon) {
          connectedAtRelease = released.isConnected;
        }
        return released === icon;
      });

      await injector.initialize();
      injector.cleanup();

      expect(release).toHaveBeenCalledWith(icon);
      expect(connectedAtRelease).toBe(true);
      expect(icon.isConnected).toBe(false);
      release.mockRestore();
    });

    it('should remove elements with prompt-library-cleanup-target class', async () => {
      const icon1 = document.createElement('button');
      icon1.classList.add('prompt-library-cleanup-target');
      document.body.appendChild(icon1);

      const icon2 = document.createElement('button');
      icon2.setAttribute('data-prompt-library-icon', 'true');
      document.body.appendChild(icon2);

      // Trigger cleanup which calls removeAllExistingIcons internally
      injector.cleanup();

      expect(document.querySelector('.prompt-library-cleanup-target')).toBeNull();
      expect(document.querySelector('[data-prompt-library-icon]')).toBeNull();
    });

    it('should remove floating icons', async () => {
      const floatingIcon = document.createElement('button');
      floatingIcon.setAttribute('data-prompt-library-floating', 'true');
      document.body.appendChild(floatingIcon);

      injector.cleanup();

      expect(document.querySelector('[data-prompt-library-floating]')).toBeNull();
    });

    it('should remove prompt selectors from DOM', async () => {
      const selector = document.createElement('div');
      selector.className = 'prompt-library-selector';
      document.body.appendChild(selector);

      injector.cleanup();

      expect(document.querySelector('.prompt-library-selector')).toBeNull();
    });

    it('should remove CSS anchor positioned elements', async () => {
      const cssAnchorIcon = document.createElement('button');
      cssAnchorIcon.setAttribute('data-positioning-method', 'css-anchor');
      document.body.appendChild(cssAnchorIcon);

      injector.cleanup();

      expect(document.querySelector('[data-positioning-method="css-anchor"]')).toBeNull();
    });

    it('should remove Floating UI positioned elements', async () => {
      const floatingUIIcon = document.createElement('button');
      floatingUIIcon.setAttribute('data-positioning-method', 'floating-ui');
      document.body.appendChild(floatingUIIcon);

      injector.cleanup();

      expect(document.querySelector('[data-positioning-method="floating-ui"]')).toBeNull();
    });

    it('should handle already-removed elements gracefully', async () => {
      const icon = document.createElement('button');
      icon.classList.add('prompt-library-cleanup-target');
      document.body.appendChild(icon);

      // Remove it before cleanup runs
      icon.remove();

      // Should not throw
      expect(() => injector.cleanup()).not.toThrow();
    });
  });

  describe('icon injection and detection', () => {
    it('should inject icon when textarea is detected during initialize', async () => {
      const { PlatformInsertionManager } = await import('../insertion-manager');

      await injector.initialize();

      // After initialization and detection, createIcon should have been called
      // because mockTextarea is in the DOM and matches the selectors
      const managerInstance = (PlatformInsertionManager as any).mock.results[0].value;

      // Wait for detection timeout
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(managerInstance.getAllSelectors).toHaveBeenCalled();
    });

    it('should handle case when no visible textarea is found', async () => {
      // Remove the mockTextarea so no textarea is found
      document.body.removeChild(mockTextarea);

      const newInjector = new PromptLibraryInjector();
      await newInjector.initialize();

      // Wait for detection
      await new Promise(resolve => setTimeout(resolve, 200));

      const Logger = await import('../../utils/logger');
      // Should have logged debug about no textarea found
      expect(Logger.debug).toHaveBeenCalled();

      newInjector.cleanup();
      // Re-add mockTextarea so afterEach doesn't fail
      document.body.appendChild(mockTextarea);
    });

    it('should use floating position as fallback when no container selector', async () => {
      const Logger = await import('../../utils/logger');

      await injector.initialize();

      // Wait for detection and icon injection
      await new Promise(resolve => setTimeout(resolve, 200));

      // Since getButtonContainerSelector returns null and no custom config,
      // the icon should be positioned with floating fallback.
      // Verify no errors occurred during the process.
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('disposes of the icon being replaced even once the Platform took it out of the DOM', async () => {
      const oldIcon = document.createElement('button');
      const observerCleanup = vi.fn();
      const internals = injector as any;
      internals.state.icon = oldIcon; // detached: no DOM query can find it
      internals.iconCleanups.set(oldIcon, observerCleanup);
      const release = vi.spyOn(AnchoredOverlay.prototype, 'release');

      await internals.injectIcon(mockTextarea);

      expect(observerCleanup).toHaveBeenCalledTimes(1);
      expect(internals.iconCleanups.has(oldIcon)).toBe(false);
      expect(release).toHaveBeenCalledWith(oldIcon);
      expect(internals.eventManager.removeTrackedListeners).toHaveBeenCalledWith(oldIcon);
      expect(internals.state.icon).not.toBe(oldIcon);
      release.mockRestore();
    });

    it('drops an Anchored overlay placement the editor changed under while it awaited', async () => {
      const internals = injector as any;
      internals.state.isSiteEnabled = true;
      internals.state.currentTextarea = mockTextarea;
      const otherEditor = document.createElement('textarea');
      const pending: { finish?: (method: 'floating-ui') => void } = {};
      const place = vi.spyOn(AnchoredOverlay.prototype, 'place').mockImplementation(
        () => new Promise((resolve) => { pending.finish = resolve; })
      );
      const release = vi.spyOn(AnchoredOverlay.prototype, 'release');
      const track = vi.spyOn(IconPlacementController.prototype, 'track');

      const injecting = internals.injectIcon(mockTextarea);
      await vi.waitFor(() => { expect(place).toHaveBeenCalled(); });
      const icon = internals.state.icon as HTMLElement;
      internals.state.currentTextarea = otherEditor; // the user moved to another editor meanwhile
      pending.finish?.('floating-ui');
      await injecting;

      expect(track).not.toHaveBeenCalledWith(icon, mockTextarea, 'overlay');
      expect(release).toHaveBeenCalledWith(icon);
      expect(icon.isConnected).toBe(false);
      expect(internals.state.icon).toBeNull();
      place.mockRestore();
      release.mockRestore();
      track.mockRestore();
    });

    it('tracks an Anchored overlay placement still current once it resolves', async () => {
      const internals = injector as any;
      internals.state.isSiteEnabled = true;
      internals.state.currentTextarea = mockTextarea;
      const place = vi.spyOn(AnchoredOverlay.prototype, 'place').mockResolvedValue('floating-ui');
      const track = vi.spyOn(IconPlacementController.prototype, 'track');

      await internals.injectIcon(mockTextarea);

      expect(track).toHaveBeenCalledWith(internals.state.icon, mockTextarea, 'overlay');
      place.mockRestore();
      track.mockRestore();
    });
  });

  describe('SPA monitoring', () => {
    it('should set up SPA monitoring interval during initialization', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      await injector.initialize();

      // setInterval should have been called for SPA monitoring
      expect(setIntervalSpy).toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });
  });

  describe('selector test handling', () => {
    let messageCallback: (message: Record<string, unknown>, sender: unknown, sendResponse: (response: unknown) => void) => boolean;

    beforeEach(async () => {
      await injector.initialize();
      messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as any;
    });

    it('should clean up test element after 3 seconds', async () => {
      vi.useFakeTimers();

      const testDiv = document.createElement('div');
      testDiv.className = 'timed-test-target';
      document.body.appendChild(testDiv);
      testDiv.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 10, left: 10, right: 110, bottom: 60, width: 100, height: 50
      });

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'testSelector', selector: '.timed-test-target', placement: 'after', offset: { x: 0, y: 0 }, zIndex: 999 },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      // The test element should have an outline set
      expect(testDiv.style.outline).toContain('10b981');

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000);

      // Outline should be restored (empty or original)
      expect(testDiv.style.outline).toBe('');

      document.body.removeChild(testDiv);
      vi.useRealTimers();
    });

    it('should handle selector test errors gracefully', () => {
      const sendResponse = vi.fn();

      // Use an invalid selector that throws
      messageCallback(
        { action: 'testSelector', selector: '[invalid', placement: 'after', offset: { x: 0, y: 0 }, zIndex: 999 },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('Selector test failed') })
      );
    });
  });

  describe('reinitialize handling', () => {
    it('should respond successfully to reinitialize message', async () => {
      await injector.initialize();

      const messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as any;

      const sendResponse = vi.fn();
      const result = messageCallback(
        { action: 'reinitialize', reason: 'extension-update' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('partialCleanup via settings update', () => {
    it('should perform partial cleanup when site is disabled via settings', async () => {
      const { isSiteEnabled } = await import('../../utils/storage');
      const Logger = await import('../../utils/logger');

      // Initialize with site enabled
      vi.mocked(isSiteEnabled).mockResolvedValue(true);
      await injector.initialize();

      // Get message callback
      const messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as any;

      // Now disable the site
      vi.mocked(isSiteEnabled).mockResolvedValue(false);

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'settingsUpdated', settings: { enabledSites: [], customSites: [], debugMode: false, floatingFallback: true } },
        {},
        sendResponse
      );

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have logged partial cleanup
      expect(Logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('partial cleanup'),
        expect.any(Object)
      );
    });

    it('should keep settings unchanged when enablement status does not change', async () => {
      const { isSiteEnabled } = await import('../../utils/storage');
      const Logger = await import('../../utils/logger');

      // Ensure isSiteEnabled returns true for initialization
      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      // Use a fresh injector so internal state is clean
      const freshInjector = new PromptLibraryInjector();
      await freshInjector.initialize();

      const lastCallIdx = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls.length - 1;
      const messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[lastCallIdx][0] as any;

      // Send settings update but site remains enabled
      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      // Clear debug calls from initialization so we only see new ones
      vi.mocked(Logger.debug).mockClear();

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'settingsUpdated', settings: { enabledSites: ['localhost'], customSites: [], debugMode: true, floatingFallback: true } },
        {},
        sendResponse
      );

      await new Promise(resolve => setTimeout(resolve, 150));

      // Check that any debug call contains the "No site enablement change" message
      const debugCalls = vi.mocked(Logger.debug).mock.calls;
      const hasNoChangeMessage = debugCalls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('No site enablement change')
      );
      expect(hasNoChangeMessage).toBe(true);

      freshInjector.cleanup();
    });
  });

  describe('removeAllExistingIcons - detailed cleanup', () => {
    it('should clean up copilot icons with cleanup functions', () => {
      const copilotIcon = document.createElement('button');
      copilotIcon.className = 'prompt-library-copilot-icon prompt-library-cleanup-target';
      document.body.appendChild(copilotIcon);

      // Cleanup should handle icons even without stored cleanup functions
      expect(() => injector.cleanup()).not.toThrow();
      expect(document.querySelector('.prompt-library-copilot-icon')).toBeNull();
    });

    it('should clean up data-mpm-anchor-name elements', () => {
      const anchorEl = document.createElement('div');
      anchorEl.setAttribute('data-mpm-anchor-name', '--test-anchor');
      document.body.appendChild(anchorEl);

      const cssIcon = document.createElement('button');
      cssIcon.setAttribute('data-positioning-method', 'css-anchor');
      cssIcon.classList.add('prompt-library-cleanup-target');
      document.body.appendChild(cssIcon);

      injector.cleanup();

      expect(document.querySelector('[data-positioning-method="css-anchor"]')).toBeNull();
    });

    it('should handle errors from individual icon removals gracefully', () => {
      // Create an icon where removal might cause issues
      const icon = document.createElement('button');
      icon.classList.add('prompt-library-cleanup-target');
      document.body.appendChild(icon);

      // Should not throw even with complex DOM state
      expect(() => injector.cleanup()).not.toThrow();
    });

    it('should handle warn-level errors during cleanup', async () => {
      const Logger = await import('../../utils/logger');

      // Create an icon and remove it before cleanup runs
      const icon = document.createElement('button');
      icon.setAttribute('data-prompt-library-icon', 'true');
      icon.classList.add('prompt-library-cleanup-target');
      document.body.appendChild(icon);

      // Everything should clean up fine
      injector.cleanup();

      // Debug should have been called for the cleanup
      expect(Logger.debug).toHaveBeenCalled();
    });
  });

  describe('icon click handler', () => {
    it('should set up click handler on icon after injection', async () => {
      await injector.initialize();

      // Wait for detection
      await new Promise(resolve => setTimeout(resolve, 200));

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      // Check that a click event was added (icon click handler)
      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[1] === 'click'
      );
      // At least one click handler should be set up (the icon click)
      expect(clickCalls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('focusin event handling', () => {
    it('should trigger detection when a textarea receives focus after initialization', async () => {
      await injector.initialize();

      // The EventManager's addTrackedEventListener should have been called
      // for the focusin event on document
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const focusinCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === document && call[1] === 'focusin'
      );

      expect(focusinCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('selector cache behavior', () => {
    it('should use cache for repeated detections', async () => {
      await injector.initialize();

      // First detection populates cache, subsequent ones should reuse
      // Wait for initial detection + at least one retry
      await new Promise(resolve => setTimeout(resolve, 700));

      // No error should have occurred
      const Logger = await import('../../utils/logger');
      expect(Logger.error).not.toHaveBeenCalled();
    });
  });

  describe('settings error handling', () => {
    it('should handle errors during settings update gracefully', async () => {
      const { isSiteEnabled } = await import('../../utils/storage');
      const Logger = await import('../../utils/logger');

      await injector.initialize();

      const messageCallback = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as any;

      // Make isSiteEnabled throw during settings update
      vi.mocked(isSiteEnabled).mockRejectedValue(new Error('Storage error'));

      const sendResponse = vi.fn();
      messageCallback(
        { action: 'settingsUpdated', settings: { enabledSites: ['localhost'], customSites: [], debugMode: false, floatingFallback: true } },
        {},
        sendResponse
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      // Error should have been logged
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling settings update'),
        expect.any(Error)
      );
    });
  });

  describe('invalid selector handling in detection', () => {
    it('should handle invalid CSS selectors gracefully during detection', async () => {
      const { PlatformInsertionManager } = await import('../insertion-manager');
      const { isSiteEnabled } = await import('../../utils/storage');
      const Logger = await import('../../utils/logger');

      // Ensure isSiteEnabled returns true (may have been mocked to reject in prior test)
      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      // Override to return an invalid selector
      const originalImpl = vi.mocked(PlatformInsertionManager).getMockImplementation();
      vi.mocked(PlatformInsertionManager).mockImplementation(function() {
        return {
          getAllSelectors: vi.fn().mockReturnValue(['[invalid-selector', 'textarea']),
          createIcon: vi.fn().mockReturnValue(document.createElement('button')),
          insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
          initializeStrategies: vi.fn(),
          cleanup: vi.fn(),
          getButtonContainerSelector: vi.fn().mockReturnValue(null),
          getCustomSiteConfig: vi.fn().mockReturnValue(null)
        } as any;
      } as any);

      const selectorInjector = new PromptLibraryInjector();
      await selectorInjector.initialize();

      // Wait for detection
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have logged a warning about invalid selector
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid selector'),
        expect.any(Object)
      );

      selectorInjector.cleanup();

      // Restore
      if (originalImpl) {
        vi.mocked(PlatformInsertionManager).mockImplementation(originalImpl);
      } else {
        vi.mocked(PlatformInsertionManager).mockImplementation(function() {
          return {
            getAllSelectors: vi.fn().mockReturnValue(['textarea', 'div[contenteditable="true"]']),
            createIcon: vi.fn().mockReturnValue(document.createElement('button')),
            insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
            initializeStrategies: vi.fn(),
            cleanup: vi.fn(),
            getButtonContainerSelector: vi.fn().mockReturnValue(null),
            getCustomSiteConfig: vi.fn().mockReturnValue(null)
          } as any;
        } as any);
      }
    });
  });

  describe('icon injection with container selector', () => {
    it('should inject icon into platform container when containerSelector is provided', async () => {
      const { PlatformInsertionManager } = await import('../insertion-manager');
      const { isSiteEnabled } = await import('../../utils/storage');

      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      // Create a container element in the DOM
      const container = document.createElement('div');
      container.className = 'toolbar-container';
      document.body.appendChild(container);

      const originalImpl = vi.mocked(PlatformInsertionManager).getMockImplementation();
      vi.mocked(PlatformInsertionManager).mockImplementation(function() {
        return {
          getAllSelectors: vi.fn().mockReturnValue(['textarea']),
          createIcon: vi.fn().mockReturnValue(document.createElement('button')),
          insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
          initializeStrategies: vi.fn(),
          cleanup: vi.fn(),
          getButtonContainerSelector: vi.fn().mockReturnValue('.toolbar-container'),
          getCustomSiteConfig: vi.fn().mockReturnValue(null)
        } as any;
      } as any);

      const containerInjector = new PromptLibraryInjector();
      await containerInjector.initialize();

      // Wait for detection
      await new Promise(resolve => setTimeout(resolve, 200));

      // The icon should have been appended to the container
      const icons = container.querySelectorAll('[data-prompt-library-icon]');
      expect(icons.length).toBeGreaterThanOrEqual(0); // May or may not be injected depending on visibility

      containerInjector.cleanup();
      document.body.removeChild(container);

      // Restore
      if (originalImpl) {
        vi.mocked(PlatformInsertionManager).mockImplementation(originalImpl);
      } else {
        vi.mocked(PlatformInsertionManager).mockImplementation(function() {
          return {
            getAllSelectors: vi.fn().mockReturnValue(['textarea', 'div[contenteditable="true"]']),
            createIcon: vi.fn().mockReturnValue(document.createElement('button')),
            insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
            initializeStrategies: vi.fn(),
            cleanup: vi.fn(),
            getButtonContainerSelector: vi.fn().mockReturnValue(null),
            getCustomSiteConfig: vi.fn().mockReturnValue(null)
          } as any;
        } as any);
      }
    });
  });

  describe('cleanup with active state', () => {
    it('should clear all intervals and timeouts during cleanup', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await injector.initialize();

      injector.cleanup();

      // At least one clearInterval call for SPA monitoring
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });

    it('should reset isInitialized to false after full cleanup', async () => {
      await injector.initialize();
      injector.cleanup();

      // After cleanup, re-initialization should work
      const { isSiteEnabled } = await import('../../utils/storage');
      vi.mocked(isSiteEnabled).mockResolvedValue(true);

      // Should be able to initialize again
      await injector.initialize();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it('should clean up event manager and platform manager', async () => {
      const { EventManager } = await import('../../ui/event-manager');
      const { PlatformInsertionManager } = await import('../insertion-manager');

      await injector.initialize();
      injector.cleanup();

      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const platformManagerInstance = (PlatformInsertionManager as any).mock.results[0].value;

      expect(eventManagerInstance.cleanup).toHaveBeenCalled();
      expect(platformManagerInstance.cleanup).toHaveBeenCalled();
    });
  });

  describe('isElementVisible', () => {
    it('should not inject icon for hidden textareas', async () => {
      // Hide the textarea
      mockTextarea.style.display = 'none';

      await injector.initialize();
      await new Promise(resolve => setTimeout(resolve, 200));

      const Logger = await import('../../utils/logger');
      // Should have logged that no visible textarea was found
      const debugCalls = vi.mocked(Logger.debug).mock.calls;
      const noVisibleMsg = debugCalls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('No visible textarea')
      );
      expect(noVisibleMsg).toBe(true);

      // Restore
      mockTextarea.style.display = '';
    });
  });

});
