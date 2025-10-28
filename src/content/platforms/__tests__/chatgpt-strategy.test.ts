/**
 * Unit tests for ChatGPTStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { ChatGPTStrategy } from '../chatgpt-strategy';

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
  hostname: 'chatgpt.com'
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('ChatGPTStrategy', () => {
  let strategy: ChatGPTStrategy;
  let mockTextarea: HTMLTextAreaElement;
  let mockDiv: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new ChatGPTStrategy();
    mockTextarea = document.createElement('textarea');
    mockTextarea.setAttribute('data-testid', 'chat-input');
    // Ensure focus method exists for spying
    mockTextarea.focus = vi.fn();

    mockDiv = document.createElement('div');

    mockUIFactory = {
      createChatGPTIcon: vi.fn().mockReturnValue(document.createElement('button'))
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create ChatGPT strategy with correct configuration', () => {
      expect(strategy.name).toBe('chatgpt');
      expect(strategy.priority).toBe(90);
      expect(strategy.getSelectors()).toContain('textarea[data-testid="chat-input"]');
      expect(strategy.getSelectors()).toContain('textarea[placeholder*="Message"]');
    });
  });

  describe('canHandle', () => {
    it('should return true for textarea elements on chatgpt.com', () => {
      expect(strategy.canHandle(mockTextarea)).toBe(true);
    });

    it('should return false for non-textarea elements on chatgpt.com', () => {
      expect(strategy.canHandle(mockDiv)).toBe(false);
    });

    it('should return false for textarea elements not on chatgpt.com', () => {
      mockLocation.hostname = 'example.com';
      const newStrategy = new ChatGPTStrategy();
      expect(newStrategy.canHandle(mockTextarea)).toBe(false);
    });
  });

  describe('getSelectors', () => {
    it('should return ChatGPT-specific selectors', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toContain('textarea[data-testid="chat-input"]');
      expect(selectors).toContain('textarea[placeholder*="Message"]');
      expect(selectors).toContain('textarea');
      expect(selectors).toContain('div[contenteditable="true"]');
    });
  });

  describe('createIcon', () => {
    it('should create ChatGPT-specific icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);
      
      expect(mockUIFactory.createChatGPTIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      // Mock DOM methods
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {});
      vi.spyOn(mockTextarea, 'dispatchEvent').mockImplementation(() => true);
      
      // Mock the native value setter
      const mockSetter = vi.fn();
      vi.spyOn(Object, 'getOwnPropertyDescriptor').mockReturnValue({
        set: mockSetter,
        get: vi.fn(),
        enumerable: true,
        configurable: true
      });
    });

    it('should insert content using React-compatible methods', async () => {
      const result = await strategy.insert(mockTextarea, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('chatgpt-react');
      expect(mockTextarea.value).toBe('test content');
      expect(mockTextarea.focus).toHaveBeenCalled();
    });

    it('should dispatch React events', async () => {
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

    it('should use native value setter when available', async () => {
      const mockSetter = vi.fn();
      const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
      Object.getOwnPropertyDescriptor = vi.fn(function(...args) {
        if (args[0] === HTMLTextAreaElement.prototype && args[1] === 'value') {
          return {
            set: mockSetter,
            get: vi.fn(),
            enumerable: true,
            configurable: true
          };
        }
        return originalGetOwnPropertyDescriptor.apply(this, args);
      }) as any;

      await strategy.insert(mockTextarea, 'test content');

      expect(mockSetter).toHaveBeenCalledWith('test content');

      // Restore
      Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor;
    });

    it('should handle case when native value setter is not available', async () => {
      const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
      Object.getOwnPropertyDescriptor = vi.fn(() => undefined) as any;

      const result = await strategy.insert(mockTextarea, 'test content');

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe('test content');

      // Restore
      Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor;
    });

    it('should handle errors gracefully', async () => {
      // Replace the focus mock to throw an error
      mockTextarea.focus = vi.fn(() => {
        throw new Error('Focus failed');
      });

      const result = await strategy.insert(mockTextarea, 'test content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Focus failed');
    });

    it('should log debug message on successful insertion', async () => {
      const Logger = await import('../../utils/logger');
      
      await strategy.insert(mockTextarea, 'test content');
      
      expect(Logger.debug).toHaveBeenCalledWith('[chatgpt] ChatGPT React insertion successful', {});
    });

    it('should log warning message on failed insertion', async () => {
      const Logger = await import('../../utils/logger');
      const error = new Error('Test error');

      // Replace the focus mock to throw an error
      mockTextarea.focus = vi.fn(() => {
        throw error;
      });

      await strategy.insert(mockTextarea, 'test content');

      expect(Logger.warn).toHaveBeenCalledWith('[chatgpt] React insertion failed', {
        error: 'Test error',
        stack: expect.stringContaining('Error: Test error')
      });
    });
  });

  describe('React integration', () => {
    it('should work with React textarea elements', async () => {
      // Simulate a React textarea with value tracker
      const reactTextarea = mockTextarea as any;
      reactTextarea._valueTracker = {
        setValue: vi.fn()
      };
      
      const result = await strategy.insert(reactTextarea, 'react content');
      
      expect(result.success).toBe(true);
      expect(reactTextarea.value).toBe('react content');
    });

    it('should trigger proper React synthetic events', async () => {
      const eventSpy = vi.spyOn(mockTextarea, 'dispatchEvent');
      
      await strategy.insert(mockTextarea, 'test content');
      
      // Check that both input and change events were dispatched
      const calls = eventSpy.mock.calls;
      expect(calls.some(call => call[0].type === 'input')).toBe(true);
      expect(calls.some(call => call[0].type === 'change')).toBe(true);
    });
  });

  describe('ChatGPT-specific behavior', () => {
    it('should only handle elements on chatgpt.com domain', () => {
      // Reset hostname to chatgpt.com for this test
      mockLocation.hostname = 'chatgpt.com';
      const chatgptStrategy = new ChatGPTStrategy();
      expect(chatgptStrategy.canHandle(mockTextarea)).toBe(true);
      
      // Change hostname
      mockLocation.hostname = 'claude.ai';
      const newStrategy = new ChatGPTStrategy();
      expect(newStrategy.canHandle(mockTextarea)).toBe(false);
      
      // Reset for other tests
      mockLocation.hostname = 'chatgpt.com';
    });

    it('should prioritize textarea elements over other input types', () => {
      // Reset hostname to chatgpt.com for this test
      mockLocation.hostname = 'chatgpt.com';
      const chatgptStrategy = new ChatGPTStrategy();
      
      const input = document.createElement('input');
      input.type = 'text';
      
      expect(chatgptStrategy.canHandle(mockTextarea)).toBe(true);
      expect(chatgptStrategy.canHandle(input)).toBe(false);
    });
  });
});