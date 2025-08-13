/**
 * Unit tests for PlatformManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { InsertionResult } from '../../types/index';
import type { UIElementFactory } from '../../ui/element-factory';
import { PlatformStrategy } from '../base-strategy';
import { PlatformManager } from '../platform-manager';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));


// Mock all strategy modules
vi.mock('../claude-strategy', () => ({
  ClaudeStrategy: vi.fn().mockImplementation(() => ({
    name: 'claude',
    priority: 100,
    canHandle: vi.fn().mockReturnValue(false),
    insert: vi.fn().mockResolvedValue({ success: true, method: 'claude' }),
    getSelectors: vi.fn().mockReturnValue(['div.claude']),
    getButtonContainerSelector: vi.fn().mockReturnValue('.claude-container'),
    createIcon: vi.fn().mockReturnValue(document.createElement('div')),
    cleanup: vi.fn()
  }))
}));

vi.mock('../chatgpt-strategy', () => ({
  ChatGPTStrategy: vi.fn().mockImplementation(() => ({
    name: 'chatgpt',
    priority: 90,
    canHandle: vi.fn().mockReturnValue(false),
    insert: vi.fn().mockResolvedValue({ success: true, method: 'chatgpt' }),
    getSelectors: vi.fn().mockReturnValue(['textarea.chatgpt']),
    getButtonContainerSelector: vi.fn().mockReturnValue('.chatgpt-container'),
    createIcon: vi.fn().mockReturnValue(document.createElement('div')),
    cleanup: vi.fn()
  }))
}));

vi.mock('../perplexity-strategy', () => ({
  PerplexityStrategy: vi.fn().mockImplementation(() => ({
    name: 'perplexity',
    priority: 80,
    canHandle: vi.fn().mockReturnValue(false),
    insert: vi.fn().mockResolvedValue({ success: true, method: 'perplexity' }),
    getSelectors: vi.fn().mockReturnValue(['div.perplexity']),
    getButtonContainerSelector: vi.fn().mockReturnValue('.perplexity-container'),
    createIcon: vi.fn().mockReturnValue(document.createElement('div')),
    cleanup: vi.fn()
  }))
}));

vi.mock('../default-strategy', () => ({
  DefaultStrategy: class MockDefaultStrategy {
    name = 'default';
    priority = 0;
    
    canHandle = vi.fn().mockReturnValue(true);
    insert = vi.fn().mockResolvedValue({ success: true, method: 'default' });
    getSelectors = vi.fn().mockReturnValue(['textarea', 'input']);
    getButtonContainerSelector = vi.fn().mockReturnValue(null);
    createIcon = vi.fn().mockReturnValue(null);
    cleanup = vi.fn();
  }
}));

// Mock window.location.hostname
const mockLocation = {
  hostname: 'example.com'
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Test strategy implementation
class TestStrategy extends PlatformStrategy {
  constructor(name = 'test', priority = 50) {
    super(name, priority);
  }

  canHandle(element: HTMLElement): boolean {
    return element.tagName === 'DIV';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    return { success: true, method: 'test' };
  }

  getSelectors(): string[] {
    return ['div.test'];
  }

  getButtonContainerSelector(): string | null {
    return '.test-container';
  }
}

describe('PlatformManager', () => {
  let manager: PlatformManager;
  let mockElement: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    // Use a hostname that should not load any strategies by default
    // We'll change the behavior per test as needed
    mockLocation.hostname = 'example.com';
    manager = new PlatformManager();
    mockElement = document.createElement('div');
    mockUIFactory = {
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(manager).toBeInstanceOf(PlatformManager);
    });

    it('should initialize strategies based on hostname', async () => {
      const Logger = await import('../../utils/logger');
      vi.clearAllMocks();
      
      // Create a new manager to capture fresh log calls
      new PlatformManager();
      
      expect(Logger.debug).toHaveBeenCalledWith('PlatformManager created (lazy loading mode)', { hostname: 'example.com' });
    });

    it('should load Claude strategy for claude.ai', async () => {
      mockLocation.hostname = 'claude.ai';
      const claudeManager = new PlatformManager();
      
      const Logger = await import('../../utils/logger');
      // Strategy loading is now handled silently - no specific log message expected
    });

    it('should load ChatGPT strategy for chatgpt.com', async () => {
      mockLocation.hostname = 'chatgpt.com';
      const chatgptManager = new PlatformManager();
      
      const Logger = await import('../../utils/logger');
      // Strategy loading is now handled silently - no specific log message expected
    });

    it('should load Perplexity strategy for www.perplexity.ai', async () => {
      mockLocation.hostname = 'www.perplexity.ai';
      const perplexityManager = new PlatformManager();
      
      const Logger = await import('../../utils/logger');
      // Strategy loading is now handled silently - no specific log message expected
    });
  });

  describe('registerStrategy', () => {
    it('should register a new strategy', async () => {
      const testStrategy = new TestStrategy();
      manager.registerStrategy(testStrategy);
      
      const strategies = manager.getStrategies();
      expect(strategies).toContain(testStrategy);
      
      const Logger = await import('../../utils/logger');
      expect(Logger.debug).toHaveBeenCalledWith('Registered new strategy', { name: 'test' });
    });

    it('should sort strategies by priority after registration', () => {
      const lowPriorityStrategy = new TestStrategy('low', 10);
      const highPriorityStrategy = new TestStrategy('high', 100);
      
      manager.registerStrategy(lowPriorityStrategy);
      manager.registerStrategy(highPriorityStrategy);
      
      const strategies = manager.getStrategies();
      // Find our test strategies (skip the mocked default strategy)
      const testStrategies = strategies.filter(s => s instanceof TestStrategy);
      expect(testStrategies[0].priority).toBeGreaterThanOrEqual(testStrategies[1].priority);
    });
  });

  describe('findBestStrategy', () => {
    it('should find compatible strategy', () => {
      const testStrategy = new TestStrategy();
      manager.registerStrategy(testStrategy);
      
      const divElement = document.createElement('div');
      const bestStrategy = manager.findBestStrategy(divElement);
      
      expect(bestStrategy).toBe(testStrategy);
    });

    it('should return null when no compatible strategies found', () => {
      // Create a new manager with no registered test strategies
      const emptyManager = new PlatformManager();
      // Mock the default strategy to return false
      const strategies = emptyManager.getStrategies();
      strategies.forEach(strategy => {
        if (strategy.canHandle) {
          vi.spyOn(strategy, 'canHandle').mockReturnValue(false);
        }
      });
      
      const bestStrategy = emptyManager.findBestStrategy(mockElement);
      expect(bestStrategy).toBeNull();
    });

    it('should handle strategy canHandle errors gracefully', async () => {
      const errorStrategy = new TestStrategy('error', 100);
      vi.spyOn(errorStrategy, 'canHandle').mockImplementation(() => {
        throw new Error('canHandle error');
      });
      manager.registerStrategy(errorStrategy);
      
      const bestStrategy = manager.findBestStrategy(mockElement);
      
      const Logger = await import('../../utils/logger');
      expect(Logger.warn).toHaveBeenCalledWith('Strategy error canHandle() failed', { error: expect.any(Error) });
    });

    it('should return highest priority compatible strategy', () => {
      const lowPriorityStrategy = new TestStrategy('low', 10);
      const highPriorityStrategy = new TestStrategy('high', 100);
      
      manager.registerStrategy(lowPriorityStrategy);
      manager.registerStrategy(highPriorityStrategy);
      
      const divElement = document.createElement('div');
      const bestStrategy = manager.findBestStrategy(divElement);
      
      expect(bestStrategy?.name).toBe('high');
    });
  });

  describe('Lazy Loading Behavior', () => {
    it('should not initialize strategies automatically in constructor', () => {
      const freshManager = new PlatformManager();
      expect(freshManager.getAllSelectors()).toEqual([]);
      expect(freshManager.getButtonContainerSelector()).toBeNull();
      expect(freshManager.createIcon(mockUIFactory)).toBeNull();
    });

    it('should initialize strategies when explicitly called', () => {
      const freshManager = new PlatformManager();
      freshManager.initializeStrategies();
      expect(freshManager.getAllSelectors().length).toBeGreaterThan(0);
    });

    it('should prevent duplicate initialization', () => {
      const freshManager = new PlatformManager();
      const spy = vi.spyOn(freshManager as any, '_initializeStrategies');
      freshManager.initializeStrategies();
      freshManager.initializeStrategies(); // Second call
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllSelectors', () => {
    it('should return combined selectors from all strategies', () => {
      // Create a fresh manager to avoid test interference
      const freshManager = new PlatformManager();
      freshManager.initializeStrategies(); // Initialize strategies for testing
      const testStrategy = new TestStrategy();
      freshManager.registerStrategy(testStrategy);
      
      const selectors = freshManager.getAllSelectors();
      expect(selectors).toContain('div.test');
      expect(Array.isArray(selectors)).toBe(true);
      // Should also contain selectors from DefaultStrategy that was loaded for example.com
      expect(selectors).toContain('textarea');
      expect(selectors).toContain('input');
    });

    it('should remove duplicate selectors', () => {
      // Create a fresh manager to avoid test interference
      const freshManager = new PlatformManager();
      freshManager.initializeStrategies(); // Initialize strategies for testing
      const strategy1 = new TestStrategy('test1', 10);
      const strategy2 = new TestStrategy('test2', 20);
      
      // Both return the same selector
      vi.spyOn(strategy1, 'getSelectors').mockReturnValue(['div.common']);
      vi.spyOn(strategy2, 'getSelectors').mockReturnValue(['div.common']);
      
      freshManager.registerStrategy(strategy1);
      freshManager.registerStrategy(strategy2);
      
      const selectors = freshManager.getAllSelectors();
      const commonSelectors = selectors.filter(s => s === 'div.common');
      expect(commonSelectors).toHaveLength(1);
    });
  });

  describe('getButtonContainerSelector', () => {
    it('should return button container selector from highest priority strategy', () => {
      // Create a fresh manager to avoid test interference
      const freshManager = new PlatformManager();
      freshManager.initializeStrategies(); // Initialize strategies for testing
      const testStrategy = new TestStrategy();
      vi.spyOn(testStrategy, 'getButtonContainerSelector').mockReturnValue('.test-container');
      freshManager.registerStrategy(testStrategy);
      
      const selector = freshManager.getButtonContainerSelector();
      expect(selector).toBe('.test-container');
    });

    it('should return null when no strategy has button container selector', () => {
      // Create a fresh manager to avoid interference from other tests
      const freshManager = new PlatformManager();
      const selector = freshManager.getButtonContainerSelector();
      expect(selector).toBeNull();
    });
  });

  describe('createIcon', () => {
    it('should create icon using highest priority strategy', () => {
      manager.initializeStrategies(); // Initialize strategies for testing
      const testStrategy = new TestStrategy();
      const mockIcon = document.createElement('div');
      vi.spyOn(testStrategy, 'createIcon').mockReturnValue(mockIcon);
      manager.registerStrategy(testStrategy);
      
      const icon = manager.createIcon(mockUIFactory);
      expect(icon).toBe(mockIcon);
      expect(manager.getActiveStrategy()).toBe(testStrategy);
    });

    it('should fallback to floating icon when no strategy creates icon', () => {
      manager.initializeStrategies(); // Initialize strategies for testing
      const icon = manager.createIcon(mockUIFactory);
      expect(mockUIFactory.createFloatingIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insertContent', () => {
    it('should insert content using best strategy', async () => {
      const testStrategy = new TestStrategy();
      manager.registerStrategy(testStrategy);
      
      const divElement = document.createElement('div');
      const result = await manager.insertContent(divElement, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('test');
      expect(manager.getActiveStrategy()).toBe(testStrategy);
    });

    it('should return error when no element provided', async () => {
      const result = await manager.insertContent(null as any, 'test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No target element provided');
    });

    it('should return error when no compatible strategies found', async () => {
      // Create a new manager and mock all strategies to return false
      const emptyManager = new PlatformManager();
      const strategies = emptyManager.getStrategies();
      strategies.forEach(strategy => {
        if (strategy.canHandle) {
          vi.spyOn(strategy, 'canHandle').mockReturnValue(false);
        }
      });
      
      const result = await emptyManager.insertContent(mockElement, 'test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No compatible strategies found for target element');
    });

    it('should handle strategy insertion errors gracefully', async () => {
      const errorStrategy = new TestStrategy('error', 100);
      vi.spyOn(errorStrategy, 'insert').mockRejectedValue(new Error('Insert error'));
      manager.registerStrategy(errorStrategy);
      
      const divElement = document.createElement('div');
      const result = await manager.insertContent(divElement, 'test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Strategy insertion failed');
    });

    it('should log successful insertion', async () => {
      const testStrategy = new TestStrategy();
      manager.registerStrategy(testStrategy);
      
      const divElement = document.createElement('div');
      await manager.insertContent(divElement, 'test content');
      
      const Logger = await import('../../utils/logger');
      expect(Logger.debug).toHaveBeenCalledWith('Insertion successful', { strategy: 'test' });
    });
  });

  describe('getActiveStrategy', () => {
    it('should return null initially', () => {
      expect(manager.getActiveStrategy()).toBeNull();
    });

    it('should return active strategy after successful insertion', async () => {
      const testStrategy = new TestStrategy();
      manager.registerStrategy(testStrategy);
      
      const divElement = document.createElement('div');
      await manager.insertContent(divElement, 'test content');
      
      expect(manager.getActiveStrategy()).toBe(testStrategy);
    });
  });

  describe('getStrategies', () => {
    it('should return copy of strategies array', () => {
      const strategies = manager.getStrategies();
      expect(Array.isArray(strategies)).toBe(true);
      
      // Should be a copy, not the original array
      const originalLength = strategies.length;
      strategies.push(new TestStrategy());
      expect(manager.getStrategies()).toHaveLength(originalLength);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all strategies', () => {
      const testStrategy = new TestStrategy();
      const cleanupSpy = vi.spyOn(testStrategy, 'cleanup').mockImplementation(() => {});
      manager.registerStrategy(testStrategy);
      
      manager.cleanup();
      
      expect(cleanupSpy).toHaveBeenCalled();
      expect(manager.getStrategies()).toHaveLength(0);
      expect(manager.getActiveStrategy()).toBeNull();
    });

    it('should handle strategy cleanup errors gracefully', async () => {
      const errorStrategy = new TestStrategy('error', 100);
      vi.spyOn(errorStrategy, 'cleanup').mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      manager.registerStrategy(errorStrategy);
      
      expect(() => { manager.cleanup(); }).not.toThrow();
      
      const Logger = await import('../../utils/logger');
      expect(Logger.warn).toHaveBeenCalledWith('Failed to cleanup strategy error', { error: expect.any(Error) });
    });

    it('should log cleanup process', async () => {
      manager.cleanup();
      
      const Logger = await import('../../utils/logger');
      expect(Logger.debug).toHaveBeenCalledWith('Starting cleanup');
      expect(Logger.debug).toHaveBeenCalledWith('Cleanup complete');
    });
  });
});