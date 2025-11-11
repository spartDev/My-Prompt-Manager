/**
 * Unit tests for CopilotStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { CopilotStrategy } from '../copilot-strategy';

import {
  createCopilotTextarea,
  createMockUIFactory,
  setMockHostname,
  resetMockHostname,
  setupDispatchEventMock,
  setupNativeValueSetterMock,
  createReactTextarea,
  COPILOT_SELECTORS,
  COPILOT_BUTTON_CONTAINER_SELECTOR,
  COPILOT_CONFIG
} from './fixtures/copilot-fixtures';

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
setMockHostname('copilot.microsoft.com');

describe('CopilotStrategy', () => {
  let strategy: CopilotStrategy;
  let mockTextarea: HTMLTextAreaElement;
  let mockDiv: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new CopilotStrategy();
    mockTextarea = createCopilotTextarea('primary');
    mockDiv = document.createElement('div');
    mockUIFactory = createMockUIFactory();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create Copilot strategy with correct configuration', () => {
      expect(strategy.name).toBe(COPILOT_CONFIG.name);
      expect(strategy.priority).toBe(COPILOT_CONFIG.priority);
      expect(strategy.getSelectors()).toContain(COPILOT_SELECTORS[0]);
      expect(strategy.getSelectors()).toContain(COPILOT_SELECTORS[1]);
    });

    it('should include all configured selectors', () => {
      const selectors = strategy.getSelectors();
      COPILOT_SELECTORS.forEach((selector) => {
        expect(selectors).toContain(selector);
      });
    });

    it('should have correct button container selector', () => {
      const buttonSelector = strategy.getButtonContainerSelector();
      expect(buttonSelector).toBe(COPILOT_BUTTON_CONTAINER_SELECTOR);
    });
  });

  describe('canHandle', () => {
    it('should return true for textarea elements on copilot.microsoft.com', () => {
      expect(strategy.canHandle(mockTextarea)).toBe(true);
    });

    it('should return false for non-textarea elements on copilot.microsoft.com', () => {
      expect(strategy.canHandle(mockDiv)).toBe(false);
    });

    it('should return false for textarea elements not on copilot.microsoft.com', () => {
      setMockHostname('example.com');
      const newStrategy = new CopilotStrategy();
      expect(newStrategy.canHandle(mockTextarea)).toBe(false);
      resetMockHostname();
    });
  });

  describe('getSelectors', () => {
    it('should return Copilot-specific selectors', () => {
      const selectors = strategy.getSelectors();
      COPILOT_SELECTORS.forEach((selector) => {
        expect(selectors).toContain(selector);
      });
    });

    it('should prioritize most specific selector first', () => {
      const selectors = strategy.getSelectors();
      expect(selectors[0]).toBe(COPILOT_SELECTORS[0]);
    });
  });

  describe('createIcon', () => {
    it('should create Copilot-specific icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);

      expect(mockUIFactory.createCopilotIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      // Mock DOM methods
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {});
      setupDispatchEventMock(mockTextarea);
    });

    it('should insert content using React-compatible methods', async () => {
      const result = await strategy.insert(mockTextarea, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('copilot-react');
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
      const { mockSetter, restore } = setupNativeValueSetterMock();

      // Reset cached setter and create new strategy to pick up mocked descriptor
      (CopilotStrategy as any).nativeValueSetter = null;
      const testStrategy = new CopilotStrategy();

      await testStrategy.insert(mockTextarea, 'test content');

      expect(mockSetter).toHaveBeenCalledWith('test content');

      // Restore
      restore();
      // Reset cache for subsequent tests
      (CopilotStrategy as any).nativeValueSetter = null;
    });

    it('should handle case when native value setter is not available', async () => {
      const { restore } = setupNativeValueSetterMock({ unavailable: true });

      // Reset cached setter and create new strategy to pick up mocked descriptor
      (CopilotStrategy as any).nativeValueSetter = null;
      const testStrategy = new CopilotStrategy();

      const result = await testStrategy.insert(mockTextarea, 'test content');

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe('test content');

      // Restore
      restore();
      // Reset cache for subsequent tests
      (CopilotStrategy as any).nativeValueSetter = null;
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

      expect(Logger.debug).toHaveBeenCalledWith('[copilot] Copilot React insertion successful', {});
    });

    it('should log warning message on failed insertion', async () => {
      const Logger = await import('../../utils/logger');
      const error = new Error('Test error');

      // Replace the focus mock to throw an error
      mockTextarea.focus = vi.fn(() => {
        throw error;
      });

      await strategy.insert(mockTextarea, 'test content');

      expect(Logger.warn).toHaveBeenCalledWith('[copilot] React insertion failed', {
        error: 'Test error',
        stack: expect.stringContaining('Error: Test error')
      });
    });
  });

  describe('React integration', () => {
    it('should work with React textarea elements', async () => {
      const reactTextarea = createReactTextarea('primary');

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

  describe('Copilot-specific behavior', () => {
    it('should only handle elements on copilot.microsoft.com domain', () => {
      // Reset hostname to copilot.microsoft.com for this test
      resetMockHostname();
      const copilotStrategy = new CopilotStrategy();
      expect(copilotStrategy.canHandle(mockTextarea)).toBe(true);

      // Change hostname
      setMockHostname('claude.ai');
      const newStrategy = new CopilotStrategy();
      expect(newStrategy.canHandle(mockTextarea)).toBe(false);

      // Reset for other tests
      resetMockHostname();
    });

    it('should prioritize textarea elements over other input types', () => {
      // Reset hostname to copilot.microsoft.com for this test
      resetMockHostname();
      const copilotStrategy = new CopilotStrategy();

      const input = document.createElement('input');
      input.type = 'text';

      expect(copilotStrategy.canHandle(mockTextarea)).toBe(true);
      expect(copilotStrategy.canHandle(input)).toBe(false);
    });
  });

  describe('selector fallback chain', () => {
    it('should have primary selector as most specific', () => {
      const selectors = strategy.getSelectors();
      expect(selectors[0]).toBe(COPILOT_SELECTORS[0]);
    });

    it('should have ID-based fallback as second option', () => {
      const selectors = strategy.getSelectors();
      expect(selectors[1]).toBe(COPILOT_SELECTORS[1]);
    });

    it('should include pattern match fallbacks', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toContain(COPILOT_SELECTORS[2]);
      expect(selectors).toContain(COPILOT_SELECTORS[3]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content insertion', async () => {
      const result = await strategy.insert(mockTextarea, '');

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe('');
    });

    it('should handle multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      const result = await strategy.insert(mockTextarea, multilineContent);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(multilineContent);
    });

    it('should handle special characters', async () => {
      const specialContent = 'Special chars: @#$%^&*()';
      const result = await strategy.insert(mockTextarea, specialContent);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(specialContent);
    });

    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(10000);
      const result = await strategy.insert(mockTextarea, longContent);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(longContent);
    });
  });
});
