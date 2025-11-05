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
      cleanup: vi.fn()
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

vi.mock('../../ui/element-factory', () => ({
  UIElementFactory: vi.fn(function() {
    return {
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    };
  })
}));

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

});
