/**
 * Unit tests for DefaultStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { DefaultStrategy } from '../default-strategy';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  Logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('DefaultStrategy', () => {
  let strategy: DefaultStrategy;
  let mockTextarea: HTMLTextAreaElement;
  let mockInput: HTMLInputElement;
  let mockContentEditableDiv: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new DefaultStrategy();
    
    mockTextarea = document.createElement('textarea');
    mockInput = document.createElement('input');
    mockInput.type = 'text';
    
    mockContentEditableDiv = document.createElement('div');
    mockContentEditableDiv.contentEditable = 'true';
    
    mockUIFactory = {
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create Default strategy with correct configuration', () => {
      expect(strategy.name).toBe('default');
      expect(strategy.priority).toBe(0);
      expect(strategy.getSelectors()).toEqual([
        'textarea',
        'input[type="text"]',
        'div[contenteditable="true"]',
        '[role="textbox"]'
      ]);
    });

    it('should have no button container selector', () => {
      expect(strategy.getButtonContainerSelector()).toBeNull();
    });
  });

  describe('canHandle', () => {
    it('should always return true as fallback strategy', () => {
      expect(strategy.canHandle(mockTextarea)).toBe(true);
      expect(strategy.canHandle(mockInput)).toBe(true);
      expect(strategy.canHandle(mockContentEditableDiv)).toBe(true);
      expect(strategy.canHandle(document.createElement('div'))).toBe(true);
      expect(strategy.canHandle(document.createElement('span'))).toBe(true);
    });
  });

  describe('getSelectors', () => {
    it('should return generic selectors', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toContain('textarea');
      expect(selectors).toContain('input[type="text"]');
      expect(selectors).toContain('div[contenteditable="true"]');
      expect(selectors).toContain('[role="textbox"]');
    });
  });

  describe('createIcon', () => {
    it('should create floating icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);
      
      expect(mockUIFactory.createFloatingIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      // Mock DOM methods
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {});
      vi.spyOn(mockTextarea, 'dispatchEvent').mockImplementation(() => true);
      vi.spyOn(mockInput, 'focus').mockImplementation(() => {});
      vi.spyOn(mockInput, 'dispatchEvent').mockImplementation(() => true);
      vi.spyOn(mockContentEditableDiv, 'focus').mockImplementation(() => {});
      vi.spyOn(mockContentEditableDiv, 'dispatchEvent').mockImplementation(() => true);
    });

    it('should insert content into textarea', async () => {
      const result = await strategy.insert(mockTextarea, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('default');
      expect(mockTextarea.value).toBe('test content');
      expect(mockTextarea.focus).toHaveBeenCalled();
    });

    it('should insert content into input', async () => {
      const result = await strategy.insert(mockInput, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('default');
      expect(mockInput.value).toBe('test content');
      expect(mockInput.focus).toHaveBeenCalled();
    });

    it('should insert content into contenteditable div', async () => {
      const result = await strategy.insert(mockContentEditableDiv, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('default');
      expect(mockContentEditableDiv.textContent).toBe('test content');
      expect(mockContentEditableDiv.focus).toHaveBeenCalled();
    });

    it('should dispatch input and change events for textarea', async () => {
      await strategy.insert(mockTextarea, 'test content');
      
      expect(mockTextarea.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true
        })
      );
      expect(mockTextarea.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change',
          bubbles: true
        })
      );
    });

    it('should dispatch input and change events for input', async () => {
      await strategy.insert(mockInput, 'test content');
      
      expect(mockInput.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true
        })
      );
      expect(mockInput.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change',
          bubbles: true
        })
      );
    });

    it('should dispatch input event for contenteditable div', async () => {
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      expect(mockContentEditableDiv.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true
        })
      );
    });

    it('should handle unknown element types gracefully', async () => {
      const unknownElement = document.createElement('span');
      vi.spyOn(unknownElement, 'focus').mockImplementation(() => {});
      vi.spyOn(unknownElement, 'dispatchEvent').mockImplementation(() => true);
      
      const result = await strategy.insert(unknownElement, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('default');
      expect(unknownElement.focus).toHaveBeenCalled();
      // Should not set any content since it's not a recognized input type
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });
      
      const result = await strategy.insert(mockTextarea, 'test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Focus failed');
    });

    it('should log debug message on successful insertion', async () => {
      const { Logger } = await import('../../utils/logger');
      
      await strategy.insert(mockTextarea, 'test content');
      
      expect(Logger.debug).toHaveBeenCalledWith('[default] Default insertion successful', {});
    });

    it('should log error message on failed insertion', async () => {
      const { Logger } = await import('../../utils/logger');
      const error = new Error('Test error');
      
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {
        throw error;
      });
      
      await strategy.insert(mockTextarea, 'test content');
      
      expect(Logger.error).toHaveBeenCalledWith('[default] Default insertion failed', error, {});
    });
  });

  describe('fallback behavior', () => {
    it('should work with any element type', async () => {
      const elements = [
        document.createElement('div'),
        document.createElement('span'),
        document.createElement('p'),
        document.createElement('section')
      ];
      
      for (const element of elements) {
        vi.spyOn(element, 'focus').mockImplementation(() => {});
        vi.spyOn(element, 'dispatchEvent').mockImplementation(() => true);
        
        expect(strategy.canHandle(element)).toBe(true);
        
        const result = await strategy.insert(element, 'test');
        expect(result.success).toBe(true);
      }
    });

    it('should have lowest priority', () => {
      expect(strategy.priority).toBe(0);
    });

    it('should provide generic selectors for common input types', () => {
      const selectors = strategy.getSelectors();
      expect(selectors.length).toBeGreaterThan(0);
      expect(selectors).toContain('textarea');
      expect(selectors).toContain('input[type="text"]');
    });
  });

  describe('element type detection', () => {
    it('should correctly identify textarea elements', async () => {
      const result = await strategy.insert(mockTextarea, 'textarea content');
      expect(mockTextarea.value).toBe('textarea content');
      expect(result.success).toBe(true);
    });

    it('should correctly identify input elements', async () => {
      const result = await strategy.insert(mockInput, 'input content');
      expect(mockInput.value).toBe('input content');
      expect(result.success).toBe(true);
    });

    it('should correctly identify contenteditable elements', async () => {
      const result = await strategy.insert(mockContentEditableDiv, 'contenteditable content');
      expect(mockContentEditableDiv.textContent).toBe('contenteditable content');
      expect(result.success).toBe(true);
    });

    it('should handle mixed case contentEditable attribute', async () => {
      const mixedCaseDiv = document.createElement('div');
      mixedCaseDiv.contentEditable = 'true'; // Set the property directly
      vi.spyOn(mixedCaseDiv, 'focus').mockImplementation(() => {});
      vi.spyOn(mixedCaseDiv, 'dispatchEvent').mockImplementation(() => true);
      
      const result = await strategy.insert(mixedCaseDiv, 'mixed case content');
      expect(mixedCaseDiv.textContent).toBe('mixed case content');
      expect(result.success).toBe(true);
    });
  });
});