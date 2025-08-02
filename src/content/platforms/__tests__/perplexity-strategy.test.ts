/**
 * Unit tests for PerplexityStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { PerplexityStrategy } from '../perplexity-strategy';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));


// Mock window.location.hostname
const mockLocation = {
  hostname: 'www.perplexity.ai'
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('PerplexityStrategy', () => {
  let strategy: PerplexityStrategy;
  let mockContentEditableDiv: HTMLElement;
  let mockTextarea: HTMLTextAreaElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new PerplexityStrategy();
    
    mockContentEditableDiv = document.createElement('div');
    mockContentEditableDiv.contentEditable = 'true';
    mockContentEditableDiv.setAttribute('role', 'textbox');
    mockContentEditableDiv.id = 'ask-input';
    
    mockTextarea = document.createElement('textarea');
    
    mockUIFactory = {
      createPerplexityIcon: vi.fn().mockReturnValue(document.createElement('button'))
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create Perplexity strategy with correct configuration', () => {
      expect(strategy.name).toBe('perplexity');
      expect(strategy.priority).toBe(80);
      expect(strategy.getSelectors()).toEqual([
        'div[contenteditable="true"][role="textbox"]#ask-input'
      ]);
    });
  });

  describe('canHandle', () => {
    it('should return true for any element on www.perplexity.ai', () => {
      expect(strategy.canHandle(mockContentEditableDiv)).toBe(true);
      expect(strategy.canHandle(mockTextarea)).toBe(true);
      expect(strategy.canHandle(document.createElement('div'))).toBe(true);
    });

    it('should return false for elements not on www.perplexity.ai', () => {
      mockLocation.hostname = 'example.com';
      const newStrategy = new PerplexityStrategy();
      expect(newStrategy.canHandle(mockContentEditableDiv)).toBe(false);
    });
  });

  describe('getSelectors', () => {
    it('should return Perplexity-specific selectors', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toEqual([
        'div[contenteditable="true"][role="textbox"]#ask-input'
      ]);
    });
  });

  describe('createIcon', () => {
    it('should create Perplexity-specific icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);
      
      expect(mockUIFactory.createPerplexityIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      // Mock DOM methods
      vi.spyOn(mockContentEditableDiv, 'focus').mockImplementation(() => {});
      vi.spyOn(mockContentEditableDiv, 'dispatchEvent').mockImplementation(() => true);
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {});
      vi.spyOn(mockTextarea, 'dispatchEvent').mockImplementation(() => true);
    });

    it('should insert content into contenteditable div', async () => {
      const result = await strategy.insert(mockContentEditableDiv, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('perplexity-selection');
      expect(mockContentEditableDiv.textContent).toBe('test content');
      expect(mockContentEditableDiv.focus).toHaveBeenCalled();
    });

    it('should insert content into textarea', async () => {
      const result = await strategy.insert(mockTextarea, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('perplexity-selection');
      expect(mockTextarea.value).toBe('test content');
      expect(mockTextarea.focus).toHaveBeenCalled();
    });

    it('should dispatch comprehensive event set', async () => {
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      const expectedEvents = ['input', 'change', 'keyup', 'compositionend', 'blur', 'focus'];
      expectedEvents.forEach(eventType => {
        expect(mockContentEditableDiv.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: eventType,
            bubbles: true
          })
        );
      });
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockContentEditableDiv, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });
      
      const result = await strategy.insert(mockContentEditableDiv, 'test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Focus failed');
    });

    it('should log debug message on successful insertion', async () => {
      const Logger = await import('../../utils/logger');
      
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      expect(Logger.debug).toHaveBeenCalledWith('[perplexity] Perplexity selection replacement successful', {});
    });

    it('should log error message on failed insertion', async () => {
      const Logger = await import('../../utils/logger');
      const error = new Error('Test error');
      
      vi.spyOn(mockContentEditableDiv, 'focus').mockImplementation(() => {
        throw error;
      });
      
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      expect(Logger.error).toHaveBeenCalledWith('[perplexity] Perplexity insertion failed', error, {});
    });
  });

  describe('Perplexity-specific behavior', () => {
    it('should handle both contenteditable and textarea elements', async () => {
      // Test contenteditable
      const contentEditableResult = await strategy.insert(mockContentEditableDiv, 'content 1');
      expect(contentEditableResult.success).toBe(true);
      expect(mockContentEditableDiv.textContent).toBe('content 1');
      
      // Test textarea
      const textareaResult = await strategy.insert(mockTextarea, 'content 2');
      expect(textareaResult.success).toBe(true);
      expect(mockTextarea.value).toBe('content 2');
    });

    it('should only handle elements on www.perplexity.ai domain', () => {
      // Reset hostname to www.perplexity.ai for this test
      mockLocation.hostname = 'www.perplexity.ai';
      const perplexityStrategy = new PerplexityStrategy();
      expect(perplexityStrategy.canHandle(mockContentEditableDiv)).toBe(true);
      
      // Change hostname
      mockLocation.hostname = 'claude.ai';
      const newStrategy = new PerplexityStrategy();
      expect(newStrategy.canHandle(mockContentEditableDiv)).toBe(false);
      
      // Reset for other tests
      mockLocation.hostname = 'www.perplexity.ai';
    });

    it('should trigger all required events for Perplexity', async () => {
      const eventSpy = vi.spyOn(mockContentEditableDiv, 'dispatchEvent');
      
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      // Check that all expected events were dispatched
      const calls = eventSpy.mock.calls;
      const eventTypes = calls.map(call => call[0].type);
      
      expect(eventTypes).toContain('input');
      expect(eventTypes).toContain('change');
      expect(eventTypes).toContain('keyup');
      expect(eventTypes).toContain('compositionend');
      expect(calls.length).toBe(6); // Exactly 6 events
    });

    it('should handle elements without specific type gracefully', async () => {
      const genericDiv = document.createElement('div');
      vi.spyOn(genericDiv, 'focus').mockImplementation(() => {});
      vi.spyOn(genericDiv, 'dispatchEvent').mockImplementation(() => true);
      
      const result = await strategy.insert(genericDiv, 'test content');
      
      expect(result.success).toBe(true);
      // Should set textContent as fallback method
      expect(genericDiv.textContent).toBe('test content');
    });
  });

  describe('event handling', () => {
    it('should create events with correct properties', async () => {
      const eventSpy = vi.spyOn(mockContentEditableDiv, 'dispatchEvent');
      
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      // Check that events have bubbles: true
      eventSpy.mock.calls.forEach(call => {
        const event = call[0];
        expect(event.bubbles).toBe(true);
      });
    });

    it('should dispatch events in correct order', async () => {
      const eventSpy = vi.spyOn(mockContentEditableDiv, 'dispatchEvent');
      
      await strategy.insert(mockContentEditableDiv, 'test content');
      
      const eventTypes = eventSpy.mock.calls.map(call => call[0].type);
      expect(eventTypes).toEqual(['input', 'change', 'keyup', 'compositionend', 'blur', 'focus']);
    });
  });
});