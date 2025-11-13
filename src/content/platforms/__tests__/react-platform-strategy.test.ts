/**
 * Unit tests for ReactPlatformStrategy base class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { InsertionResult, PlatformConfig } from '../../types/index';
import type { UIElementFactory } from '../../ui/element-factory';
import { ReactPlatformStrategy } from '../react-platform-strategy';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

/**
 * Concrete test implementation of ReactPlatformStrategy
 * Used to test the abstract base class functionality
 */
class TestReactStrategy extends ReactPlatformStrategy {
  constructor(name = 'test-react', priority = 50, config?: PlatformConfig, hostname?: string) {
    super(name, priority, config, hostname);
    TestReactStrategy.initializeNativeValueSetter();
  }

  canHandle(element: HTMLElement): boolean {
    return element.tagName === 'TEXTAREA';
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      const validation = this.validateAndSanitize(content, 1000);
      if (!validation.valid) {
        return await Promise.resolve({
          success: false,
          error: validation.error
        });
      }

      if (typeof validation.sanitized !== 'string') {
        return await Promise.resolve({
          success: false,
          error: 'Content sanitization failed'
        });
      }

      return await this.insertIntoReactTextarea(
        element as HTMLTextAreaElement,
        validation.sanitized,
        'TestReact'
      );
    } catch (error) {
      return await Promise.resolve({
        success: false,
        error: (error as Error).message
      });
    }
  }

  getSelectors(): string[] {
    return this.config?.selectors || ['textarea'];
  }

  createIcon?(_uiFactory: UIElementFactory): HTMLElement | null {
    return null;
  }
}

describe('ReactPlatformStrategy', () => {
  let strategy: TestReactStrategy;
  let mockTextarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create mock textarea
    mockTextarea = document.createElement('textarea');
    document.body.appendChild(mockTextarea);

    // Create strategy instance
    strategy = new TestReactStrategy();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should create ReactPlatformStrategy with correct configuration', () => {
      expect(strategy.name).toBe('test-react');
      expect(strategy.priority).toBe(50);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: PlatformConfig = {
        selectors: ['textarea.custom'],
        buttonContainerSelector: 'div.button-container',
        priority: 75
      };

      const customStrategy = new TestReactStrategy('custom', 75, customConfig);
      expect(customStrategy.name).toBe('custom');
      expect(customStrategy.priority).toBe(75);
      expect(customStrategy.getSelectors()).toContain('textarea.custom');
    });

    it('should initialize with custom hostname', () => {
      const customStrategy = new TestReactStrategy('test', 50, undefined, 'custom.example.com');
      expect(customStrategy).toBeDefined();
      // Hostname is protected, but we can verify the strategy was created successfully
    });

    it('should cache native value setter on initialization', async () => {
      // Create a new strategy to trigger initialization
      const newStrategy = new TestReactStrategy();
      expect(newStrategy).toBeDefined();

      // The native setter should be cached (we can't directly test the private static,
      // but we can verify insertion works, which depends on it)
      const textarea = document.createElement('textarea');
      const result = newStrategy.insert(textarea, 'test');
      await expect(result).resolves.toMatchObject({ success: true });
    });
  });

  describe('validateAndSanitize', () => {
    it('should validate and return sanitized content for valid string', async () => {
      const content = 'Hello, World!';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);
    });

    it('should reject non-string content', async () => {
      // Test with number (cast to any to bypass TypeScript check)
      const result = await strategy.insert(mockTextarea, 123 as unknown as string);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid content type');
    });

    it('should reject content exceeding maximum length', async () => {
      const longContent = 'a'.repeat(1001); // Max is 1000 in TestReactStrategy
      const result = await strategy.insert(mockTextarea, longContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content exceeds maximum length');
    });

    it('should accept content at maximum length boundary', async () => {
      const maxContent = 'a'.repeat(1000); // Exactly at max
      const result = await strategy.insert(mockTextarea, maxContent);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(maxContent);
    });

    it('should sanitize control characters while preserving newlines', async () => {
      const content = 'Line 1\nLine 2\tTabbed\rCarriage Return';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toContain('\n'); // Preserves newline
      expect(mockTextarea.value).toContain('\t'); // Preserves tab
      expect(mockTextarea.value).toContain('\r'); // Preserves carriage return
    });

    it('should remove dangerous control characters', async () => {
      // String with NULL, backspace, vertical tab
      const content = 'Hello\x00World\x08Test\x0BMore';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      // Control characters should be removed
      expect(mockTextarea.value).toBe('HelloWorldTestMore');
    });

    it('should handle empty string', async () => {
      const result = await strategy.insert(mockTextarea, '');

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe('');
    });

    it('should handle whitespace-only content', async () => {
      const content = '   \n\t\n   ';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);
    });
  });

  describe('insertIntoReactTextarea', () => {
    it('should focus the textarea before insertion', async () => {
      const focusSpy = vi.spyOn(mockTextarea, 'focus');

      await strategy.insert(mockTextarea, 'Test content');

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should set textarea value', async () => {
      const content = 'Test content';
      await strategy.insert(mockTextarea, content);

      expect(mockTextarea.value).toBe(content);
    });

    it('should dispatch input event', async () => {
      const inputSpy = vi.fn();
      mockTextarea.addEventListener('input', inputSpy);

      await strategy.insert(mockTextarea, 'Test content');

      expect(inputSpy).toHaveBeenCalled();
    });

    it('should dispatch change event', async () => {
      const changeSpy = vi.fn();
      mockTextarea.addEventListener('change', changeSpy);

      await strategy.insert(mockTextarea, 'Test content');

      expect(changeSpy).toHaveBeenCalled();
    });

    it('should dispatch events with bubbles: true', async () => {
      const inputSpy = vi.fn();
      const changeSpy = vi.fn();

      mockTextarea.addEventListener('input', (e) => {
        inputSpy(e.bubbles);
      });
      mockTextarea.addEventListener('change', (e) => {
        changeSpy(e.bubbles);
      });

      await strategy.insert(mockTextarea, 'Test content');

      expect(inputSpy).toHaveBeenCalledWith(true);
      expect(changeSpy).toHaveBeenCalledWith(true);
    });

    it('should call native value setter if available', async () => {
      // Mock native value setter
      const nativeSetterSpy = vi.fn();
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      );

      if (descriptor?.set) {
        const originalSetter = descriptor.set;
        const mockSetter = function (this: HTMLTextAreaElement, value: string) {
          nativeSetterSpy(value);
          originalSetter.call(this, value);
        };

        Object.defineProperty(window.HTMLTextAreaElement.prototype, 'value', {
          ...descriptor,
          set: mockSetter
        });
      }

      // Re-initialize strategy to pick up mocked setter
      const newStrategy = new TestReactStrategy();
      await newStrategy.insert(mockTextarea, 'Test content');

      // The native setter should be called
      expect(nativeSetterSpy).toHaveBeenCalledWith('Test content');

      // Restore original descriptor
      if (descriptor) {
        Object.defineProperty(window.HTMLTextAreaElement.prototype, 'value', descriptor);
      }
    });

    it('should return success result with correct method name', async () => {
      const result = await strategy.insert(mockTextarea, 'Test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('testreact-textarea');
    });

    it('should handle multiline content correctly', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);
    });

    it('should handle special characters in content', async () => {
      const content = 'Special: @#$%^&*()_+-=[]{}|;:\'"<>?,./';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);
    });

    it('should handle unicode characters', async () => {
      const content = 'Hello 世界 🌍 Привет';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);
    });

    it('should handle errors gracefully', async () => {
      // Create a broken textarea that throws on focus
      const brokenTextarea = document.createElement('textarea');
      vi.spyOn(brokenTextarea, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });

      const result = await strategy.insert(brokenTextarea, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Focus failed');
    });
  });

  describe('integration with derived classes', () => {
    it('should allow derived classes to use validateAndSanitize', async () => {
      // This test verifies that derived classes can access protected methods
      const result = await strategy.insert(mockTextarea, 'Valid content');
      expect(result.success).toBe(true);
    });

    it('should allow derived classes to use insertIntoReactTextarea', async () => {
      // This test verifies that derived classes can call insertIntoReactTextarea
      const result = await strategy.insert(mockTextarea, 'Test content');
      expect(result.success).toBe(true);
      expect(result.method).toBe('testreact-textarea');
    });

    it('should allow derived classes to customize platform name in logs', async () => {
      // Create a custom strategy with a different platform name
      class CustomReactStrategy extends ReactPlatformStrategy {
        constructor() {
          super('custom-react', 60);
          CustomReactStrategy.initializeNativeValueSetter();
        }

        canHandle(element: HTMLElement): boolean {
          return element.tagName === 'TEXTAREA';
        }

        insert(element: HTMLElement, content: string): Promise<InsertionResult> {
          const validation = this.validateAndSanitize(content, 500);
          if (!validation.valid || !validation.sanitized) {
            return Promise.resolve({ success: false, error: validation.error || 'Validation failed' });
          }
          return this.insertIntoReactTextarea(
            element as HTMLTextAreaElement,
            validation.sanitized,
            'CustomPlatform'
          );
        }

        getSelectors(): string[] {
          return ['textarea'];
        }
      }

      const customStrategy = new CustomReactStrategy();
      const result = await customStrategy.insert(mockTextarea, 'Test');

      expect(result.success).toBe(true);
      expect(result.method).toBe('customplatform-textarea');
    });
  });

  describe('edge cases and security', () => {
    it('should handle very long valid content', async () => {
      const longContent = 'a'.repeat(999); // Just under limit
      const result = await strategy.insert(mockTextarea, longContent);

      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(longContent);
    });

    it('should prevent XSS attempts in content', async () => {
      const xssContent = '<script>alert("XSS")</script>';
      const result = await strategy.insert(mockTextarea, xssContent);

      // Content should be inserted as plain text, not executed
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(xssContent);
      // Verify no script was executed (value is plain text)
      expect(mockTextarea.value).toContain('<script>');
    });

    it('should handle null bytes in content', async () => {
      const content = 'Before\x00After';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      // Null byte should be removed
      expect(mockTextarea.value).toBe('BeforeAfter');
    });

    it('should handle content with only control characters', async () => {
      const content = '\x00\x01\x02\x03';
      const result = await strategy.insert(mockTextarea, content);

      expect(result.success).toBe(true);
      // All control characters should be removed
      expect(mockTextarea.value).toBe('');
    });
  });
});
