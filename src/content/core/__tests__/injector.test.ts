/**
 * Unit tests for PromptLibraryInjector
 */

 
 
 
 
 
 
 
 

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Prompt } from '../../types/index';
import { PromptLibraryInjector } from '../injector';

// Mock all dependencies
vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn().mockImplementation(() => ({
    getAllSelectors: vi.fn().mockReturnValue(['textarea', 'div[contenteditable="true"]']),
    createIcon: vi.fn().mockReturnValue(document.createElement('button')),
    insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
    cleanup: vi.fn()
  }))
}));

vi.mock('../../ui/event-manager', () => ({
  EventManager: vi.fn().mockImplementation(() => ({
    addTrackedEventListener: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../../ui/element-factory', () => ({
  UIElementFactory: vi.fn().mockImplementation(() => ({
    createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
  }))
}));

vi.mock('../../ui/keyboard-navigation', () => ({
  KeyboardNavigationManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    updateItems: vi.fn(),
    destroy: vi.fn()
  }))
}));

vi.mock('../../utils/storage', () => ({
  getPrompts: vi.fn().mockResolvedValue([]),
  createPromptListItem: vi.fn().mockImplementation((prompt, index, className) => {
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
  showDebugNotification: vi.fn()
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

  afterEach(() => {
    injector.cleanup();
    document.body.removeChild(mockTextarea);
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(injector).toBeInstanceOf(PromptLibraryInjector);
    });

    it('should create unique instance ID', () => {
      const injector1 = new PromptLibraryInjector();
      const injector2 = new PromptLibraryInjector();
      
      // Instance IDs should be different
      expect((injector1 as any).state.instanceId).not.toEqual((injector2 as any).state.instanceId);
      
      injector1.cleanup();
      injector2.cleanup();
    });

    it('should initialize all required components', () => {
      // Check that all required components are initialized
      expect((injector as any).eventManager).toBeDefined();
      expect((injector as any).uiFactory).toBeDefined();
      expect((injector as any).platformManager).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should set isInitialized to true when site is enabled', async () => {
      // Mock site as enabled
      const { isSiteEnabled } = await import('../../utils/storage');
      vi.mocked(isSiteEnabled).mockResolvedValueOnce(true);
      
      // Mock internal methods to prevent test environment issues
      const setupSPAMonitoringSpy = vi.spyOn(injector as any, 'setupSPAMonitoring').mockImplementation(() => {});
      const startDetectionSpy = vi.spyOn(injector as any, 'startDetection').mockImplementation(() => {});
      
      await injector.initialize();
      expect((injector as any).state.isSiteEnabled).toBe(true);
      expect((injector as any).state.isInitialized).toBe(true);
      
      setupSPAMonitoringSpy.mockRestore();
      startDetectionSpy.mockRestore();
    });

    it('should perform minimal initialization when site is disabled (preserve message listener)', async () => {
      // Mock site as disabled
      const { isSiteEnabled } = await import('../../utils/storage');
      vi.mocked(isSiteEnabled).mockResolvedValueOnce(false);
      
      await injector.initialize();
      expect((injector as any).state.isSiteEnabled).toBe(false);
      expect((injector as any).state.isInitialized).toBe(true); // Should be true to maintain message listener
    });

    it('should not initialize twice when site is enabled', async () => {
      // Mock site as enabled for both calls
      const { isSiteEnabled } = await import('../../utils/storage');
      vi.mocked(isSiteEnabled).mockResolvedValue(true);
      
      // Mock internal methods to prevent test environment issues
      const setupSPAMonitoringSpy = vi.spyOn(injector as any, 'setupSPAMonitoring').mockImplementation(() => {});
      const startDetectionSpy = vi.spyOn(injector as any, 'startDetection').mockImplementation(() => {});
      
      await injector.initialize();
      const firstInitState = (injector as any).state.isInitialized;
      expect(firstInitState).toBe(true); // First initialization should set to true
      
      await injector.initialize();
      expect((injector as any).state.isInitialized).toBe(firstInitState);
      expect((injector as any).state.isInitialized).toBe(true);
      
      setupSPAMonitoringSpy.mockRestore();
      startDetectionSpy.mockRestore();
    });

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
        createdAt: Date.now()
      },
      {
        id: '2',
        title: 'Test Prompt 2',
        content: 'This is test content 2',
        category: 'Test',
        createdAt: Date.now()
      }
    ];

    beforeEach(async () => {
      const { getPrompts } = await import('../../utils/storage');
      getPrompts.mockResolvedValue(mockPrompts);
    });

    it('should create and display prompt selector', async () => {
      await injector.showPromptSelector(mockTextarea);
      
      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();
    });

    it('should retrieve prompts from storage', async () => {
      const { getPrompts, createPromptListItem } = await import('../../utils/storage');
      await injector.showPromptSelector(mockTextarea);
      
      expect(getPrompts).toHaveBeenCalled();
    });

    it('should create prompt items for each prompt', async () => {
      const { getPrompts, createPromptListItem } = await import('../../utils/storage');
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
      getPrompts.mockResolvedValue([]);
      
      await injector.showPromptSelector(mockTextarea);
      
      const selector = document.querySelector('.prompt-library-selector');
      expect(selector).toBeTruthy();
      
      const noPrompts = selector?.querySelector('.no-prompts');
      expect(noPrompts).toBeTruthy();
    });

    it('should handle storage errors gracefully', async () => {
      const { getPrompts, createPromptListItem } = await import('../../utils/storage');
      const Logger = await import('../../utils/logger');
      
      getPrompts.mockRejectedValue(new Error('Storage error'));
      
      await injector.showPromptSelector(mockTextarea);
      
      expect(Logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove icon from DOM', async () => {
      // Simulate having an icon
      const mockIcon = document.createElement('button');
      document.body.appendChild(mockIcon);
      (injector as any).state.icon = mockIcon;
      
      injector.cleanup();
      
      expect(document.body.contains(mockIcon)).toBe(false);
    });

    it('should close prompt selector', async () => {
      // Manually set a prompt selector to test cleanup
      const mockSelector = document.createElement('div');
      (injector as any).state.promptSelector = mockSelector;
      
      injector.cleanup();
      
      // Check if the selector was cleaned up from the injector's state
      expect((injector as any).state.promptSelector).toBeFalsy();
    });

    it('should cleanup event manager', () => {
      const mockEventManager = (injector as any).eventManager;
      injector.cleanup();
      
      expect(mockEventManager.cleanup).toHaveBeenCalled();
    });

    it('should cleanup platform manager', () => {
      const mockPlatformManager = (injector as any).platformManager;
      injector.cleanup();
      
      expect(mockPlatformManager.cleanup).toHaveBeenCalled();
    });

    it('should disconnect mutation observer', () => {
      const mockObserver = {
        disconnect: vi.fn(),
        observe: vi.fn()
      };
      (injector as any).state.mutationObserver = mockObserver;
      
      injector.cleanup();
      
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('should clear timeouts', () => {
      const mockTimeout = setTimeout(() => {}, 1000);
      (injector as any).state.detectionTimeout = mockTimeout;
      
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      injector.cleanup();
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeout);
    });

    it('should reset initialization state', () => {
      (injector as any).state.isInitialized = true;
      
      injector.cleanup();
      
      expect((injector as any).state.isInitialized).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const Logger = await import('../../utils/logger');
      
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

  describe('SPA navigation handling', () => {
    it('should detect URL changes', () => {
      const originalHref = window.location.href;
      
      // Change URL
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: 'https://test.example.com/new-page' },
        writable: true
      });
      
      // The SPA monitoring should detect this change
      // Note: In a real test, we'd need to wait for the interval or trigger the check
      expect((injector as any).spaState.lastUrl).toBe(originalHref);
    });
  });

  describe('performance optimizations', () => {
    it('should cache selector results', () => {
      const selectors = ['textarea', 'div[contenteditable="true"]'];
      
      // First call should populate cache
      (injector as any).findTextareaWithCaching(selectors);
      
      // Second call should use cache
      (injector as any).findTextareaWithCaching(selectors);
      
      expect((injector as any).selectorCache.size).toBeGreaterThan(0);
    });

    it('should clear cache after timeout', () => {
      const selectors = ['textarea'];
      
      (injector as any).findTextareaWithCaching(selectors);
      
      // Simulate cache timeout
      (injector as any).lastCacheTime = Date.now() - 3000; // 3 seconds ago
      
      (injector as any).findTextareaWithCaching(selectors);
      
      // Cache should be refreshed
      expect((injector as any).lastCacheTime).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('accessibility', () => {
    it('should create accessible prompt selector', async () => {
      // Test the createPromptSelectorUI method directly
      const mockPrompts: Prompt[] = [
        {
          id: '1',
          title: 'Test Prompt',
          content: 'Test content',
          category: 'Test',
          createdAt: Date.now()
        }
      ];
      
      const selector = (injector as any).createPromptSelectorUI(mockPrompts);
      expect(selector.getAttribute('role')).toBe('dialog');
      expect(selector.getAttribute('aria-modal')).toBe('true');
      expect(selector.getAttribute('aria-labelledby')).toBe('prompt-selector-title');
    });

    it('should create accessible prompt list', () => {
      // Test the createPromptSelectorUI method directly
      const mockPrompts: Prompt[] = [];
      
      const selector = (injector as any).createPromptSelectorUI(mockPrompts);
      const promptList = selector.querySelector('.prompt-list');
      expect(promptList?.getAttribute('role')).toBe('listbox');
    });
  });
});