/**
 * Unit tests for PlatformStrategy base class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformStrategy } from '../base-strategy';
import type { InsertionResult, PlatformConfig } from '../../types/index';
import type { UIElementFactory } from '../../ui/element-factory';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  Logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Concrete implementation for testing
class TestStrategy extends PlatformStrategy {
  constructor(name = 'test', priority = 50, config?: PlatformConfig) {
    super(name, priority, config);
  }

  canHandle(element: HTMLElement): boolean {
    return element.tagName === 'TEXTAREA';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    return { success: true, method: 'test' };
  }

  getSelectors(): string[] {
    return ['textarea', 'input'];
  }
}

// Incomplete implementation for testing validation
class IncompleteStrategy extends PlatformStrategy {
  constructor() {
    super('incomplete', 10);
  }

  canHandle(element: HTMLElement): boolean {
    return true;
  }

  // Missing insert and getSelectors methods
}

describe('PlatformStrategy', () => {
  let mockElement: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    mockElement = document.createElement('textarea');
    mockUIFactory = {} as UIElementFactory;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a strategy with correct properties', () => {
      const config = { selectors: ['textarea'], priority: 100 };
      const strategy = new TestStrategy('test', 50, config);

      expect(strategy.name).toBe('test');
      expect(strategy.priority).toBe(50);
      expect(strategy.hostname).toBe(window.location.hostname);
    });

    it('should throw error when trying to instantiate abstract class directly', () => {
      expect(() => {
        new (PlatformStrategy as any)('test', 50);
      }).toThrow('PlatformStrategy is abstract and cannot be instantiated');
    });

    it('should validate implementation and throw error for incomplete strategies', () => {
      expect(() => {
        new (IncompleteStrategy as any)();
      }).toThrow('Strategy incomplete must implement insert() method');
    });
  });

  describe('abstract methods', () => {
    let strategy: TestStrategy;

    beforeEach(() => {
      strategy = new TestStrategy();
    });

    it('should implement canHandle method', () => {
      expect(strategy.canHandle(mockElement)).toBe(true);
      
      const divElement = document.createElement('div');
      expect(strategy.canHandle(divElement)).toBe(false);
    });

    it('should implement insert method', async () => {
      const result = await strategy.insert(mockElement, 'test content');
      expect(result).toEqual({ success: true, method: 'test' });
    });

    it('should implement getSelectors method', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toEqual(['textarea', 'input']);
    });
  });

  describe('getButtonContainerSelector', () => {
    it('should return button container selector from config', () => {
      const config = { 
        selectors: ['textarea'], 
        buttonContainerSelector: '.button-container',
        priority: 100 
      };
      const strategy = new TestStrategy('test', 50, config);

      expect(strategy.getButtonContainerSelector()).toBe('.button-container');
    });

    it('should return null when no button container selector in config', () => {
      const strategy = new TestStrategy();
      expect(strategy.getButtonContainerSelector()).toBeNull();
    });
  });

  describe('createIcon', () => {
    it('should return null by default', () => {
      const strategy = new TestStrategy();
      expect(strategy.createIcon?.(mockUIFactory)).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should not throw when cleanup is called', () => {
      const strategy = new TestStrategy();
      expect(() => strategy.cleanup?.()).not.toThrow();
    });
  });

  describe('logging methods', () => {
    let strategy: TestStrategy;

    beforeEach(() => {
      strategy = new TestStrategy();
    });

    it('should log debug messages with platform prefix', async () => {
      const { Logger } = await import('../../utils/logger');
      
      (strategy as any)._debug('test message', { key: 'value' });
      
      expect(Logger.debug).toHaveBeenCalledWith('[test] test message', { key: 'value' });
    });

    it('should log warnings with platform prefix', async () => {
      const { Logger } = await import('../../utils/logger');
      
      (strategy as any)._warn('test warning', { error: 'details' });
      
      expect(Logger.warn).toHaveBeenCalledWith('[test] test warning', { error: 'details' });
    });

    it('should log errors with platform prefix', async () => {
      const { Logger } = await import('../../utils/logger');
      const error = new Error('test error');
      
      (strategy as any)._error('test error message', error, { context: 'test' });
      
      expect(Logger.error).toHaveBeenCalledWith('[test] test error message', error, { context: 'test' });
    });
  });

  describe('validation', () => {
    it('should validate that required methods are implemented', () => {
      // This should not throw since TestStrategy implements all required methods
      expect(() => new TestStrategy()).not.toThrow();
    });

    it('should throw error when required methods are missing', () => {
      class InvalidStrategy extends PlatformStrategy {
        constructor() {
          super('invalid', 10);
        }
        // Missing all required methods
      }

      expect(() => new (InvalidStrategy as any)()).toThrow('Strategy invalid must implement canHandle() method');
    });
  });
});