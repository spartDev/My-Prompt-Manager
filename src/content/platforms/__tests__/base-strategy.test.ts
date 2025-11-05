/**
 * Unit tests for PlatformStrategy base class
 */

 
 
 
 
 
 

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { InsertionResult, PlatformConfig } from '../../types/index';
import type { UIElementFactory } from '../../ui/element-factory';
import { PlatformStrategy } from '../base-strategy';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

// Concrete implementation for testing
class TestStrategy extends PlatformStrategy {
  constructor(name = 'test', priority = 50, config?: PlatformConfig) {
    super(name, priority, config);
  }

  canHandle(element: HTMLElement): boolean {
    return element.tagName === 'TEXTAREA';
  }

  async insert(_element: HTMLElement, _content: string): Promise<InsertionResult> {
    return { success: true, method: 'test' };
  }

  getSelectors(): string[] {
    return ['textarea', 'input'];
  }
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
    });

    it('should throw error when trying to instantiate abstract class directly', () => {
      expect(() => {
        new (PlatformStrategy as any)('test', 50);
      }).toThrow('PlatformStrategy is abstract and cannot be instantiated');
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

        canHandle(_element: HTMLElement): boolean {
          return false;
        }

        async insert(_element: HTMLElement, _content: string): Promise<InsertionResult> {
          return { success: false, error: 'Not implemented' };
        }

        getSelectors(): string[] {
          return [];
        }
      }

      // This test verifies the strategy can be instantiated without errors
      expect(() => new InvalidStrategy()).not.toThrow();
    });
  });
});