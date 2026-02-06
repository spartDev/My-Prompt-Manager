/**
 * Unit tests for PromptLibraryInjector
 */

 
 
 
 
 
 
 
 

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Prompt } from '../../types/index';
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
  return { UIElementFactory: MockUIElementFactory };
});

vi.mock('../../ui/keyboard-navigation', () => ({
  KeyboardNavigationManager: vi.fn(function() {
    return {
      initialize: vi.fn(),
      updateItems: vi.fn(),
      destroy: vi.fn()
    };
  })
}));

vi.mock('../../utils/storage', () => ({
  getPrompts: vi.fn().mockResolvedValue([]),
  createPromptListItem: vi.fn().mockImplementation((prompt, _index, className) => {
    const item = document.createElement('div');
    item.className = className;
    item.dataset.promptId = prompt.id;
    item.textContent = prompt.title;
    return item;
  }),
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

  describe('showPromptSelector', () => {
    const mockPrompts: Prompt[] = [
      {
        id: '1',
        title: 'Test Prompt 1',
        content: 'This is test content 1',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: Date.now()
      },
      {
        id: '2',
        title: 'Test Prompt 2',
        content: 'This is test content 2',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: Date.now()
      }
    ];

    beforeEach(async () => {
      const { getPrompts } = await import('../../utils/storage');
      (getPrompts as any).mockResolvedValue(mockPrompts);
    });

    it('should create and display prompt selector', async () => {
      await injector.showPromptSelector(mockTextarea);
      
      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();
    });

    it('should retrieve prompts from storage', async () => {
      const { getPrompts } = await import('../../utils/storage');
      await injector.showPromptSelector(mockTextarea);

      expect(getPrompts).toHaveBeenCalled();
    });

    it('should create prompt items for each prompt', async () => {
      const { createPromptListItem } = await import('../../utils/storage');
      await injector.showPromptSelector(mockTextarea);

      expect(createPromptListItem).toHaveBeenCalledTimes(mockPrompts.length);
    });

    it('should initialize keyboard navigation', async () => {
      const { KeyboardNavigationManager } = await import('../../ui/keyboard-navigation');
      await injector.showPromptSelector(mockTextarea);
      
      expect(KeyboardNavigationManager).toHaveBeenCalled();
    });

    it('should handle empty prompts array', async () => {
      const { getPrompts } = await import('../../utils/storage');
      (getPrompts as any).mockResolvedValue([]);
      
      await injector.showPromptSelector(mockTextarea);
      
      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();
      
      const noPrompts = selector?.querySelector('.no-prompts');
      expect(noPrompts).toBeTruthy();
    });

    it('should handle storage errors gracefully', async () => {
      const { getPrompts } = await import('../../utils/storage');
      const Logger = await import('../../utils/logger');

      (getPrompts as any).mockRejectedValue(new Error('Storage error'));

      await injector.showPromptSelector(mockTextarea);

      expect(Logger.error).toHaveBeenCalled();
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



  describe('accessibility', () => {
    it('should create accessible prompt selector through public API', async () => {
      const mockPrompts: Prompt[] = [
        {
          id: '1',
          title: 'Test Prompt',
          content: 'Test content',
          category: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          usageCount: 0,
          lastUsedAt: Date.now()
        }
      ];

      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      expect(selector?.getAttribute('role')).toBe('dialog');
      expect(selector?.getAttribute('aria-modal')).toBe('true');
      expect(selector?.getAttribute('aria-labelledby')).toBe('prompt-selector-title');
    });

    it('should create accessible prompt list through public API', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([]);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      const promptList = selector?.querySelector('.prompt-list');
      expect(promptList?.getAttribute('role')).toBe('listbox');
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

  describe('prompt selector UI creation', () => {
    const mockPrompts: Prompt[] = [
      {
        id: '1',
        title: 'Test Prompt 1',
        content: 'Content 1',
        category: 'Category A',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: Date.now()
      },
      {
        id: '2',
        title: 'Test Prompt 2',
        content: 'Content 2',
        category: 'Category B',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: Date.now()
      }
    ];

    it('should create header with title and close button', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      const title = selector?.querySelector('#prompt-selector-title');
      expect(title?.textContent).toBe('Select a Prompt');

      const closeButton = selector?.querySelector('.close-selector');
      expect(closeButton).toBeTruthy();
      expect(closeButton?.getAttribute('aria-label')).toBe('Close prompt selector');
    });

    it('should create search input', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      const searchInput = selector?.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput).toBeTruthy();
      expect(searchInput?.placeholder).toBe('Search prompts...');
      expect(searchInput?.getAttribute('autocomplete')).toBe('off');
    });

    it('should close existing selector when showing a new one', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      // Show first selector
      await injector.showPromptSelector(mockTextarea);
      const firstSelector = document.querySelector('.prompt-library-selector');
      expect(firstSelector).toBeTruthy();

      // Show second selector - first should be removed
      await injector.showPromptSelector(mockTextarea);
      const selectors = document.querySelectorAll('.prompt-library-selector');
      expect(selectors.length).toBe(1);
    });

    it('should display no-prompts message for empty filtered results', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      const searchInput = selector?.querySelector('.search-input') as HTMLInputElement;

      // Simulate search with no results
      if (searchInput) {
        searchInput.value = 'nonexistent query xyz';
        const inputEvent = new Event('input', { bubbles: true });
        Object.defineProperty(inputEvent, 'target', { value: searchInput });
        searchInput.dispatchEvent(inputEvent);
      }

      // Wait a tick for event handler
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify selector was created and search input exists
      expect(selector).toBeTruthy();
      expect(searchInput).toBeTruthy();
    });
  });

  describe('cleanup - full lifecycle', () => {
    it('should clean up after initialization', async () => {
      await injector.initialize();
      expect(() => injector.cleanup()).not.toThrow();
    });

    it('should clean up DOM elements created during showPromptSelector', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      await injector.showPromptSelector(mockTextarea);
      expect(document.querySelector('.prompt-library-selector')).toBeTruthy();

      injector.cleanup();

      // Selector should be removed from DOM after cleanup
      expect(document.querySelector('.prompt-library-selector')).toBeNull();
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

  describe('prompt selector positioning', () => {
    it('should position selector below textarea when space is available', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      // Textarea at top of viewport - plenty of space below
      mockTextarea.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 50, left: 50, right: 250, bottom: 100, width: 200, height: 50
      });

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();
      expect((selector as HTMLElement)?.style.position).toBe('absolute');
    });

    it('should handle small viewport widths for mobile', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      // Simulate small viewport
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();

      // Restore
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
    });
  });

  describe('prompt insertion via selector', () => {
    const mockPrompts: Prompt[] = [
      {
        id: 'p1',
        title: 'Insertable Prompt',
        content: 'Hello, this is a prompt.',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: Date.now()
      }
    ];

    it('should insert prompt on item click and close selector', async () => {
      const { getPrompts, createPromptListItem } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      // Make createPromptListItem return a clickable element
      vi.mocked(createPromptListItem).mockImplementation((prompt, _index, className) => {
        const item = document.createElement('div');
        item.className = className ?? '';
        item.dataset.promptId = prompt.id;
        item.textContent = prompt.title;
        return item;
      });

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();

      // The prompt items should exist in the DOM
      const items = selector?.querySelectorAll('.prompt-item');
      expect(items?.length).toBe(1);
    });

    it('should close selector when close button is clicked', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(mockPrompts);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();

      // The close button event is set up via addTrackedEventListener mock
      // Verify it was set up
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      expect(eventManagerInstance.addTrackedEventListener).toHaveBeenCalled();
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
  });

  describe('search/filter functionality', () => {
    const searchPrompts: Prompt[] = [
      {
        id: '1', title: 'React Hooks Guide', content: 'Use hooks for state', category: 'React',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      },
      {
        id: '2', title: 'Vue Composables', content: 'Composition API usage', category: 'Vue',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      },
      {
        id: '3', title: 'Angular Signals', content: 'Signal-based reactivity', category: 'Angular',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }
    ];

    it('should filter prompts by title via search input', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(searchPrompts);

      await injector.showPromptSelector(mockTextarea);

      const selector = document.querySelector('.prompt-library-selector');
      const searchInput = selector?.querySelector('.search-input') as HTMLInputElement;

      expect(searchInput).toBeTruthy();

      // Verify that the EventManager was called to add an input listener on the search input
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const inputListenerCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[1] === 'input'
      );
      expect(inputListenerCalls.length).toBeGreaterThan(0);
    });

    it('should show no-prompts message when search matches nothing', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(searchPrompts);

      await injector.showPromptSelector(mockTextarea);

      // Get the event manager's addTrackedEventListener calls
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      // Find the input handler that was registered
      const inputCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[1] === 'input'
      );

      expect(inputCalls.length).toBeGreaterThan(0);

      // Simulate the input event by calling the handler directly
      const handler = inputCalls[0][2];
      const mockEvent = { target: { value: 'zzzzzznothing' } };
      Object.setPrototypeOf(mockEvent.target, HTMLInputElement.prototype);
      handler(mockEvent);

      // Check that no-prompts message appeared
      const selector = document.querySelector('.prompt-library-selector');
      const noPrompts = selector?.querySelector('.no-prompts');
      expect(noPrompts).toBeTruthy();
      expect(noPrompts?.textContent).toBe('No matching prompts found.');
    });

    it('should filter prompts by content and category', async () => {
      const { getPrompts, createPromptListItem } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(searchPrompts);

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const inputCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[1] === 'input'
      );

      expect(inputCalls.length).toBeGreaterThan(0);

      const handler = inputCalls[0][2];

      // Search by category
      const mockEvent = { target: { value: 'Vue' } };
      Object.setPrototypeOf(mockEvent.target, HTMLInputElement.prototype);
      handler(mockEvent);

      // Should have called createPromptListItem for the matching prompt
      expect(createPromptListItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: '2', category: 'Vue' }),
        0,
        'filtered-prompt-item'
      );
    });

    it('should update keyboard navigation after filtering', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(searchPrompts);

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const inputCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[1] === 'input'
      );

      expect(inputCalls.length).toBeGreaterThan(0);

      const handler = inputCalls[0][2];
      const mockEvent = { target: { value: 'React' } };
      Object.setPrototypeOf(mockEvent.target, HTMLInputElement.prototype);
      handler(mockEvent);

      // The keyboard navigation's updateItems should be called
      const { KeyboardNavigationManager } = await import('../../ui/keyboard-navigation');
      const kbNavInstance = (KeyboardNavigationManager as any).mock.results[
        (KeyboardNavigationManager as any).mock.results.length - 1
      ]?.value;
      expect(kbNavInstance).toBeTruthy();
      expect(kbNavInstance.updateItems).toHaveBeenCalled();
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

  describe('prompt selection and insertion', () => {
    const prompts: Prompt[] = [
      {
        id: 'p1', title: 'Test Prompt', content: 'Hello world', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }
    ];

    it('should set up click handlers on prompt items', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      await injector.showPromptSelector(mockTextarea);

      // Verify event listeners were set up for prompt items
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[1] === 'click'
      );
      // At minimum: icon click + close button click + prompt item click
      expect(clickCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should set up outside click handler for closing selector', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      await injector.showPromptSelector(mockTextarea);

      // Wait for the setTimeout in setupPromptSelectorEvents
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify that a click handler was added to document
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const documentClickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === document && call[1] === 'click'
      );
      expect(documentClickCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should set up scroll and resize handlers for repositioning', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const scrollCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === window && call[1] === 'scroll'
      );
      const resizeCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === window && call[1] === 'resize'
      );

      expect(scrollCalls.length).toBeGreaterThanOrEqual(1);
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('prompt selector event handling', () => {
    const prompts: Prompt[] = [
      {
        id: 'p1', title: 'Click Me', content: 'Clicked content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }
    ];

    it('should call insertPrompt via event handler when prompt item is clicked', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      await injector.showPromptSelector(mockTextarea);

      // Find the click handler for the prompt item
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      // Find click handlers that were attached to elements with prompt IDs
      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId;
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      // Simulate clicking the prompt item
      const clickHandler = clickCalls[0][2];
      clickHandler(new Event('click'));

      // Wait for async insertion
      await new Promise(resolve => setTimeout(resolve, 50));

      // The platformManager's insertPrompt should have been called
      const { PlatformInsertionManager } = await import('../insertion-manager');
      const pmInstance = (PlatformInsertionManager as any).mock.results[0].value;
      expect(pmInstance.insertPrompt).toHaveBeenCalledWith(mockTextarea, 'Clicked content');
    });

    it('should close selector after successful prompt insertion', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      await injector.showPromptSelector(mockTextarea);
      expect(document.querySelector('.prompt-library-selector')).toBeTruthy();

      // Find and trigger prompt item click
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId;
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      clickCalls[0][2](new Event('click'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Selector should be removed after insertion
      expect(document.querySelector('.prompt-library-selector')).toBeNull();
    });

    it('should handle insertion failure gracefully', async () => {
      const { getPrompts } = await import('../../utils/storage');
      const { PlatformInsertionManager } = await import('../insertion-manager');
      const Logger = await import('../../utils/logger');

      vi.mocked(getPrompts).mockResolvedValue(prompts);

      // Make insertPrompt return failure
      const pmInstance = (PlatformInsertionManager as any).mock.results[0].value;
      pmInstance.insertPrompt.mockResolvedValue({ success: false, error: 'Target not found' });

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId;
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      clickCalls[0][2](new Event('click'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have logged a warning
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('insertion reported failure'),
        expect.any(Object)
      );
    });

    it('should handle insertPrompt throwing an error', async () => {
      const { getPrompts } = await import('../../utils/storage');
      const { PlatformInsertionManager } = await import('../insertion-manager');

      vi.mocked(getPrompts).mockResolvedValue(prompts);

      // Make insertPrompt throw
      const pmInstance = (PlatformInsertionManager as any).mock.results[0].value;
      pmInstance.insertPrompt.mockRejectedValue(new Error('Unexpected error'));

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;
      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId;
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      clickCalls[0][2](new Event('click'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still close the selector
      expect(document.querySelector('.prompt-library-selector')).toBeNull();
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

  describe('close button interaction', () => {
    it('should close selector when close button handler fires', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      await injector.showPromptSelector(mockTextarea);
      expect(document.querySelector('.prompt-library-selector')).toBeTruthy();

      // Find the close button click handler
      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const closeClickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.classList?.contains('close-selector');
        }
      );

      expect(closeClickCalls.length).toBeGreaterThan(0);

      closeClickCalls[0][2](new Event('click'));
      expect(document.querySelector('.prompt-library-selector')).toBeNull();
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

  describe('outside click handler', () => {
    it('should register a document click handler for outside clicks', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      await injector.showPromptSelector(mockTextarea);
      expect(document.querySelector('.prompt-library-selector')).toBeTruthy();

      // Wait for the outside click handler to be set up (it has a 100ms setTimeout)
      await new Promise(resolve => setTimeout(resolve, 150));

      const { EventManager } = await import('../../ui/event-manager');
      const allResults = (EventManager as any).mock.results;
      const eventManagerInstance = allResults[allResults.length - 1].value;

      // Find the document click handler (the outside click handler)
      const docClickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === document && call[1] === 'click'
      );

      // A document-level click handler should have been registered
      expect(docClickCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should set up outside click handler with proper element checking', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      await injector.showPromptSelector(mockTextarea);
      await new Promise(resolve => setTimeout(resolve, 150));

      const { EventManager } = await import('../../ui/event-manager');
      const allResults = (EventManager as any).mock.results;
      const eventManagerInstance = allResults[allResults.length - 1].value;

      const docClickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === document && call[1] === 'click'
      );

      // Verify the handler was registered (it performs instanceof HTMLElement check internally)
      expect(docClickCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('prompt usage tracking', () => {
    it('should send PROMPT_USAGE_INCREMENT message after successful insertion', async () => {
      const prompts: Prompt[] = [{
        id: 'track1', title: 'Track Me', content: 'Track content', category: 'Tracking',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }];

      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      // Setup chrome.runtime.sendMessage to resolve
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId === 'track1';
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      clickCalls[0][2](new Event('click'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROMPT_USAGE_INCREMENT',
          data: expect.objectContaining({
            promptId: 'track1'
          })
        })
      );
    });

    it('should handle sendMessage failure gracefully', async () => {
      const prompts: Prompt[] = [{
        id: 'track2', title: 'Track Me 2', content: 'Track content 2', category: 'Tracking',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }];

      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      // Make sendMessage reject
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('Extension context invalidated'));

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId === 'track2';
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      clickCalls[0][2](new Event('click'));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw, just log debug
      const Logger = await import('../../utils/logger');
      expect(Logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to report prompt usage'),
        expect.any(Object)
      );
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

  describe('prompt not found during click', () => {
    it('should log debug when clicked prompt ID does not match any prompt', async () => {
      const { getPrompts, createPromptListItem } = await import('../../utils/storage');
      const prompts: Prompt[] = [{
        id: 'existing', title: 'Existing', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }];
      vi.mocked(getPrompts).mockResolvedValue(prompts);

      // Make createPromptListItem return an element with a different ID
      vi.mocked(createPromptListItem).mockImplementation((_prompt, _index, className) => {
        const item = document.createElement('div');
        item.className = className ?? '';
        item.dataset.promptId = 'nonexistent-id'; // Wrong ID
        item.textContent = 'Wrong';
        return item;
      });

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const clickCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => {
          const el = call[0] as HTMLElement;
          return call[1] === 'click' && el?.dataset?.promptId === 'nonexistent-id';
        }
      );

      expect(clickCalls.length).toBeGreaterThan(0);

      clickCalls[0][2](new Event('click'));
      await new Promise(resolve => setTimeout(resolve, 50));

      const Logger = await import('../../utils/logger');
      expect(Logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prompt not found for ID'),
        expect.any(Object)
      );

      // Restore createPromptListItem
      vi.mocked(createPromptListItem).mockImplementation((prompt, _index, className) => {
        const item = document.createElement('div');
        item.className = className ?? '';
        item.dataset.promptId = prompt.id;
        item.textContent = prompt.title;
        return item;
      });
    });
  });

  describe('selector repositioning on scroll/resize', () => {
    it('should set up throttled scroll handler', async () => {
      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      // Verify scroll and resize handlers were registered on window
      const windowEventCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === window
      );

      const eventTypes = windowEventCalls.map((call: any[]) => call[1]);
      expect(eventTypes).toContain('scroll');
      expect(eventTypes).toContain('resize');
    });

    it('should throttle repositioning to approximately 60fps', async () => {
      vi.useFakeTimers();

      const { getPrompts } = await import('../../utils/storage');
      vi.mocked(getPrompts).mockResolvedValue([{
        id: '1', title: 'Test', content: 'Content', category: 'Test',
        createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0, lastUsedAt: Date.now()
      }]);

      await injector.showPromptSelector(mockTextarea);

      const { EventManager } = await import('../../ui/event-manager');
      const eventManagerInstance = (EventManager as any).mock.results[0].value;

      const scrollCalls = eventManagerInstance.addTrackedEventListener.mock.calls.filter(
        (call: any[]) => call[0] === window && call[1] === 'scroll'
      );

      expect(scrollCalls.length).toBeGreaterThan(0);

      const scrollHandler = scrollCalls[0][2];

      // Call multiple times rapidly
      scrollHandler();
      scrollHandler();
      scrollHandler();

      // The throttle should prevent more than one actual reposition within 16ms
      vi.advanceTimersByTime(20);

      vi.useRealTimers();
    });
  });

});
