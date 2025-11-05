import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line import/order
import type { UIElementFactory } from '../../ui/element-factory';

// Mock the sanitization function using proper factory
vi.mock('../../utils/storage', () => ({
  sanitizeUserInput: vi.fn()
}));

import { MistralStrategy } from '../mistral-strategy';

// Get the mocked function after import
const { sanitizeUserInput: mockSanitizeUserInput } = vi.mocked(await import('../../utils/storage'));

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

const mockLocation = {
  hostname: 'chat.mistral.ai'
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('MistralStrategy', () => {
  let strategy: MistralStrategy;
  let mockElement: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new MistralStrategy();
    mockElement = document.createElement('div');
    mockElement.contentEditable = 'true';
    mockElement.classList.add('ProseMirror');

    mockUIFactory = {
      createMistralIcon: vi.fn().mockReturnValue(document.createElement('button'))
    } as any;

    // Reset sanitization mock to return content unchanged by default
    mockSanitizeUserInput.mockImplementation((content: string) => content);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create Mistral strategy with correct configuration', () => {
      expect(strategy.name).toBe('Mistral');
      expect(strategy.priority).toBe(85);
      expect(strategy.getSelectors()).toEqual([
        'div[contenteditable="true"]',
        'textarea[placeholder*="chat"]',
        '[role="textbox"]'
      ]);
    });

    it('should configure button container selector', () => {
      const containerSelector = strategy.getButtonContainerSelector();
      expect(containerSelector).toContain('.flex.w-full.max-w-full.items-center.justify-start.gap-3');
      expect(containerSelector).toContain('.flex.w-full.items-center.justify-start.gap-3');
      expect(containerSelector).toContain('.flex.items-center.justify-start.gap-3');
    });
  });

  describe('canHandle', () => {
    it('should return true for textarea with chat placeholder', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('placeholder', 'Type your chat message here');

      expect(strategy.canHandle(textarea)).toBe(true);
    });

    it('should return true for contentEditable with ProseMirror class', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.classList.add('ProseMirror');

      expect(strategy.canHandle(div)).toBe(true);
    });

    it('should return true for contentEditable with ProseMirror child', () => {
      const parent = document.createElement('div');
      parent.contentEditable = 'true';
      const child = document.createElement('div');
      child.classList.add('ProseMirror');
      parent.appendChild(child);

      expect(strategy.canHandle(parent)).toBe(true);
    });

    it('should return true for elements with textbox role', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'textbox');

      expect(strategy.canHandle(div)).toBe(true);
    });

    it('should return false for unsuitable elements', () => {
      const div = document.createElement('div');

      expect(strategy.canHandle(div)).toBe(false);
    });
  });

  describe('createIcon', () => {
    it('should create Mistral-specific icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);

      expect(mockUIFactory.createMistralIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert - Content Sanitization', () => {
    beforeEach(() => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'click').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);
    });

    it('should sanitize content before insertion', async () => {
      const originalContent = '<script>alert("xss")</script>Hello World';
      const sanitizedContent = 'Hello World';
      mockSanitizeUserInput.mockReturnValue(sanitizedContent);

      const pElement = document.createElement('p');
      mockElement.appendChild(pElement);

      const result = await strategy.insert(mockElement, originalContent);

      expect(mockSanitizeUserInput).toHaveBeenCalledWith(originalContent);
      expect(result.success).toBe(true);
      expect(pElement.textContent).toBe(sanitizedContent);
    });

    it('should log debug message when content is modified during sanitization', async () => {
      const Logger = await import('../../utils/logger');
      const originalContent = '<script>alert("xss")</script>Hello';
      const sanitizedContent = 'Hello';
      mockSanitizeUserInput.mockReturnValue(sanitizedContent);

      const pElement = document.createElement('p');
      mockElement.appendChild(pElement);

      await strategy.insert(mockElement, originalContent);

      expect(Logger.debug).toHaveBeenCalledWith(
        '[Mistral] Content was sanitized during insertion',
        expect.objectContaining({
          originalLength: originalContent.length,
          sanitizedLength: sanitizedContent.length,
          contentModified: true
        })
      );
    });

    it('should handle empty content after sanitization', async () => {
      const Logger = await import('../../utils/logger');
      const originalContent = '<script>alert("xss")</script>';
      mockSanitizeUserInput.mockReturnValue('');

      const result = await strategy.insert(mockElement, originalContent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content could not be sanitized safely');
      expect(Logger.warn).toHaveBeenCalledWith(
        '[Mistral] Content sanitization resulted in empty content',
        expect.objectContaining({
          originalLength: originalContent.length,
          wasEmpty: false
        })
      );
    });

    it('should handle originally empty content', async () => {
      const Logger = await import('../../utils/logger');
      mockSanitizeUserInput.mockReturnValue('');

      const result = await strategy.insert(mockElement, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content could not be sanitized safely');
      expect(Logger.warn).toHaveBeenCalledWith(
        '[Mistral] Content sanitization resulted in empty content',
        expect.objectContaining({
          originalLength: 0,
          wasEmpty: true
        })
      );
    });
  });

  describe('insert - ProseMirror paragraph insertion', () => {
    beforeEach(() => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'click').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);
      mockSanitizeUserInput.mockReturnValue('test content');
    });

    it('should attempt ProseMirror paragraph insertion first', async () => {
      const pElement = document.createElement('p');
      mockElement.appendChild(pElement);

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-prosemirror-p');
      expect(pElement.textContent).toBe('test content');
      expect(mockElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'input' })
      );
    });

    it('should attempt ProseMirror transaction when paragraph method not available', async () => {
      const mockView = {
        state: {
          tr: {
            insertText: vi.fn().mockReturnValue({})
          },
          selection: { from: 0, to: 0 }
        },
        dispatch: vi.fn()
      };

      (mockElement as any)._pmViewDesc = { view: mockView };

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-prosemirror-transaction');
      expect(mockView.state.tr.insertText).toHaveBeenCalledWith('test content', 0, 0);
      expect(mockView.dispatch).toHaveBeenCalled();
    });
  });

  describe('insert - ExecCommand fallback', () => {
    beforeEach(() => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'click').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);
      mockSanitizeUserInput.mockReturnValue('test content');

      (document as any).execCommand = vi.fn().mockReturnValue(true);

      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn()
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      const mockRange = {
        selectNodeContents: vi.fn()
      };
      vi.spyOn(document, 'createRange').mockReturnValue(mockRange as any);
    });

    it('should fall back to execCommand when ProseMirror methods fail', async () => {
      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-execCommand');
      expect((document as any).execCommand).toHaveBeenCalledWith('insertText', false, 'test content');
    });

    it('should wait for focus delay before execCommand', async () => {
      vi.useFakeTimers();

      const insertPromise = strategy.insert(mockElement, 'test content');

      // Fast-forward time to simulate delay
      await vi.advanceTimersToNextTimerAsync();

      const result = await insertPromise;

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-execCommand');

      vi.useRealTimers();
    });
  });

  describe('insert - DOM manipulation fallback', () => {
    beforeEach(() => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);
      mockSanitizeUserInput.mockReturnValue('test content');
      (document as any).execCommand = vi.fn().mockReturnValue(false);
    });

    it('should handle textarea elements', async () => {
      const textarea = document.createElement('textarea');
      vi.spyOn(textarea, 'focus').mockImplementation(() => {});
      vi.spyOn(textarea, 'dispatchEvent').mockImplementation(() => true);

      const result = await strategy.insert(textarea, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-textarea');
      expect(textarea.value).toBe('test content');
    });

    it('should handle contentEditable elements with text node insertion', async () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      vi.spyOn(div, 'focus').mockImplementation(() => {});
      vi.spyOn(div, 'dispatchEvent').mockImplementation(() => true);
      vi.spyOn(div, 'removeChild');
      vi.spyOn(div, 'appendChild');

      const result = await strategy.insert(div, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-contenteditable');
      expect(div.appendChild).toHaveBeenCalledWith(expect.any(Node));
    });

    it('should clear existing content before inserting new content', async () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.innerHTML = 'existing content';
      vi.spyOn(div, 'focus').mockImplementation(() => {});
      vi.spyOn(div, 'dispatchEvent').mockImplementation(() => true);
      // Mock sanitization to return 'new content' instead of 'test content'
      mockSanitizeUserInput.mockReturnValue('new content');

      const result = await strategy.insert(div, 'new content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-contenteditable');
      expect(div.textContent).toBe('new content');
    });

    it('should warn when element is not suitable for DOM manipulation', async () => {
      const Logger = await import('../../utils/logger');
      const span = document.createElement('span');
      vi.spyOn(span, 'focus').mockImplementation(() => {});

      const result = await strategy.insert(span, 'test content');

      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalledWith(
        '[Mistral] Element is not suitable for DOM manipulation',
        expect.objectContaining({
          tagName: 'SPAN',
          contentEditable: span.contentEditable,
          hasTextarea: false
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockSanitizeUserInput.mockReturnValue('test content');
    });

    it('should handle errors gracefully in ProseMirror insertion', async () => {
      const Logger = await import('../../utils/logger');

      // Mock ProseMirror element to force ProseMirror insertion path
      const pElement = document.createElement('p');
      mockElement.appendChild(pElement);
      vi.spyOn(pElement, 'textContent', 'set').mockImplementation(() => {
        throw new Error('Focus failed');
      });

      await strategy.insert(mockElement, 'test content');

      expect(Logger.warn).toHaveBeenCalledWith(
        '[Mistral] ProseMirror insertion failed',
        expect.objectContaining({
          error: 'Focus failed'
        })
      );
    });

    it('should handle errors gracefully in execCommand', async () => {
      const Logger = await import('../../utils/logger');

      vi.spyOn(mockElement, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });

      await strategy.insert(mockElement, 'test content');

      expect(Logger.warn).toHaveBeenCalled();
    });

    it('should handle errors gracefully in DOM manipulation', async () => {
      const Logger = await import('../../utils/logger');

      const div = document.createElement('div');
      div.contentEditable = 'true';
      vi.spyOn(div, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });
      // Ensure execCommand fails to force DOM manipulation path
      (document as any).execCommand = vi.fn().mockReturnValue(false);

      const result = await strategy.insert(div, 'test content');

      expect(Logger.error).toHaveBeenCalledWith(
        '[Mistral] DOM manipulation failed',
        expect.any(Error),
        expect.any(Object)
      );
      expect(result.success).toBe(false);
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      mockSanitizeUserInput.mockReturnValue('test content');
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'click').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);
    });

    it('should trigger comprehensive events for ProseMirror insertion', async () => {
      const pElement = document.createElement('p');
      mockElement.appendChild(pElement);

      await strategy.insert(mockElement, 'test content');

      expect(mockElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true
        })
      );
      expect(mockElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change',
          bubbles: true
        })
      );
    });

    it('should trigger InputEvent with proper data for execCommand', async () => {
      (document as any).execCommand = vi.fn().mockReturnValue(true);
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn()
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);
      const mockRange = { selectNodeContents: vi.fn() };
      vi.spyOn(document, 'createRange').mockReturnValue(mockRange as any);

      // Use fake timers to avoid timeout issues
      vi.useFakeTimers();
      const insertPromise = strategy.insert(mockElement, 'test content');
      await vi.advanceTimersToNextTimerAsync();
      await insertPromise;
      vi.useRealTimers();

      expect(mockElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true,
          cancelable: true
        })
      );
    });
  });
});