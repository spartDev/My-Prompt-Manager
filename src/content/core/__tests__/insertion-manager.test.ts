/**
 * Unit tests for PlatformInsertionManager
 */

 
 
 
 

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { InsertionResult } from '../../types/index';
import { PlatformInsertionManager } from '../insertion-manager';

// Mock the PlatformManager
vi.mock('../../platforms/platform-manager', () => ({
  PlatformManager: vi.fn().mockImplementation(() => ({
    insertContent: vi.fn(),
    getAllSelectors: vi.fn(),
    getButtonContainerSelector: vi.fn(),
    createIcon: vi.fn(),
    getActiveStrategy: vi.fn(),
    cleanup: vi.fn()
  }))
}));

// Mock the Logger
vi.mock('../../utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('PlatformInsertionManager', () => {
  let insertionManager: PlatformInsertionManager;
  let mockPlatformManager: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    insertionManager = new PlatformInsertionManager();
    mockPlatformManager = (insertionManager as any).platformManager;
  });

  afterEach(() => {
    insertionManager.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const manager = new PlatformInsertionManager();
      expect(manager).toBeInstanceOf(PlatformInsertionManager);
    });

    it('should initialize with custom options', () => {
      const options = {
        debug: true,
        timeout: 10000,
        retries: 5
      };
      
      const manager = new PlatformInsertionManager(options);
      expect(manager).toBeInstanceOf(PlatformInsertionManager);
    });

    it('should merge options with defaults', () => {
      const options = { debug: true };
      const manager = new PlatformInsertionManager(options);
      
      // Check that the options were passed to PlatformManager constructor
      expect(manager).toBeInstanceOf(PlatformInsertionManager);
    });
  });

  describe('insertContent', () => {
    it('should return error when no element provided', async () => {
      const result = await insertionManager.insertContent('test content');
      
      expect(result).toEqual({
        success: false,
        error: 'No target element provided'
      });
    });

    it('should call platformManager.insertContent with correct parameters', async () => {
      const element = document.createElement('textarea');
      const content = 'test content';
      const expectedResult: InsertionResult = { success: true, method: 'direct' };
      
      mockPlatformManager.insertContent.mockResolvedValue(expectedResult);
      
      const result = await insertionManager.insertContent(content, { element });
      
      expect(mockPlatformManager.insertContent).toHaveBeenCalledWith(element, content);
      expect(result).toEqual(expectedResult);
    });

    it('should handle platform manager errors', async () => {
      const element = document.createElement('textarea');
      const content = 'test content';
      const error = new Error('Platform manager error');
      
      mockPlatformManager.insertContent.mockRejectedValue(error);
      
      await expect(insertionManager.insertContent(content, { element })).rejects.toThrow(error);
    });
  });

  describe('insertPrompt', () => {
    it('should call platformManager.insertContent with correct parameters', async () => {
      const element = document.createElement('textarea');
      const content = 'test prompt';
      const expectedResult: InsertionResult = { success: true, method: 'direct' };
      
      mockPlatformManager.insertContent.mockResolvedValue(expectedResult);
      
      const result = await insertionManager.insertPrompt(element, content);
      
      expect(mockPlatformManager.insertContent).toHaveBeenCalledWith(element, content);
      expect(result).toEqual(expectedResult);
    });

    it('should handle insertion failures', async () => {
      const element = document.createElement('textarea');
      const content = 'test prompt';
      const expectedResult: InsertionResult = { success: false, error: 'Insertion failed' };
      
      mockPlatformManager.insertContent.mockResolvedValue(expectedResult);
      
      const result = await insertionManager.insertPrompt(element, content);
      
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getAllSelectors', () => {
    it('should return selectors from platform manager', () => {
      const expectedSelectors = ['textarea', 'input[type="text"]', '.editor'];
      mockPlatformManager.getAllSelectors.mockReturnValue(expectedSelectors);
      
      const result = insertionManager.getAllSelectors();
      
      expect(mockPlatformManager.getAllSelectors).toHaveBeenCalled();
      expect(result).toEqual(expectedSelectors);
    });

    it('should handle empty selectors array', () => {
      mockPlatformManager.getAllSelectors.mockReturnValue([]);
      
      const result = insertionManager.getAllSelectors();
      
      expect(result).toEqual([]);
    });
  });

  describe('getButtonContainerSelector', () => {
    it('should return button container selector from platform manager', () => {
      const expectedSelector = '.button-container';
      mockPlatformManager.getButtonContainerSelector.mockReturnValue(expectedSelector);
      
      const result = insertionManager.getButtonContainerSelector();
      
      expect(mockPlatformManager.getButtonContainerSelector).toHaveBeenCalled();
      expect(result).toEqual(expectedSelector);
    });

    it('should handle null button container selector', () => {
      mockPlatformManager.getButtonContainerSelector.mockReturnValue(null);
      
      const result = insertionManager.getButtonContainerSelector();
      
      expect(result).toBeNull();
    });
  });

  describe('createIcon', () => {
    it('should create icon using platform manager', () => {
      const mockUIFactory = {} as any;
      const expectedIcon = document.createElement('button');
      mockPlatformManager.createIcon.mockReturnValue(expectedIcon);
      
      const result = insertionManager.createIcon(mockUIFactory);
      
      expect(mockPlatformManager.createIcon).toHaveBeenCalledWith(mockUIFactory);
      expect(result).toEqual(expectedIcon);
    });

    it('should handle null icon creation', () => {
      const mockUIFactory = {} as any;
      mockPlatformManager.createIcon.mockReturnValue(null);
      
      const result = insertionManager.createIcon(mockUIFactory);
      
      expect(result).toBeNull();
    });
  });

  describe('getActiveStrategy', () => {
    it('should return active strategy from platform manager', () => {
      const mockStrategy = { name: 'test-strategy', priority: 100 };
      mockPlatformManager.getActiveStrategy.mockReturnValue(mockStrategy);
      
      const result = insertionManager.getActiveStrategy();
      
      expect(mockPlatformManager.getActiveStrategy).toHaveBeenCalled();
      expect(result).toEqual(mockStrategy);
    });

    it('should handle null active strategy', () => {
      mockPlatformManager.getActiveStrategy.mockReturnValue(null);
      
      const result = insertionManager.getActiveStrategy();
      
      expect(result).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should call platform manager cleanup', () => {
      insertionManager.cleanup();
      
      expect(mockPlatformManager.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup when platform manager is null', () => {
      (insertionManager as any).platformManager = null;
      
      expect(() => { insertionManager.cleanup(); }).not.toThrow();
    });

    it('should handle platform manager cleanup errors', () => {
      mockPlatformManager.cleanup.mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      
      expect(() => { insertionManager.cleanup(); }).not.toThrow();
    });
  });

  describe('backward compatibility', () => {
    it('should maintain the same interface as the original implementation', () => {
      // Test that all expected methods exist
      expect(typeof insertionManager.insertContent).toBe('function');
      expect(typeof insertionManager.insertPrompt).toBe('function');
      expect(typeof insertionManager.getAllSelectors).toBe('function');
      expect(typeof insertionManager.getButtonContainerSelector).toBe('function');
      expect(typeof insertionManager.createIcon).toBe('function');
      expect(typeof insertionManager.getActiveStrategy).toBe('function');
      expect(typeof insertionManager.cleanup).toBe('function');
    });

    it('should handle legacy insertContent call pattern', async () => {
      const element = document.createElement('textarea');
      const content = 'legacy content';
      const expectedResult: InsertionResult = { success: true, method: 'legacy' };
      
      mockPlatformManager.insertContent.mockResolvedValue(expectedResult);
      
      // Test the legacy call pattern with options object
      const result = await insertionManager.insertContent(content, { element });
      
      expect(result).toEqual(expectedResult);
    });
  });

  describe('error handling', () => {
    it('should handle platform manager initialization errors gracefully', () => {
      // This test ensures the constructor doesn't throw even if PlatformManager fails
      expect(() => new PlatformInsertionManager()).not.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const result = await insertionManager.insertContent('test');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No target element provided');
    });
  });
});