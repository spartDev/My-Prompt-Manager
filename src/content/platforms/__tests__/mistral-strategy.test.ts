import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { MistralStrategy } from '../mistral-strategy';

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

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create Mistral strategy with correct configuration', () => {
      expect(strategy.name).toBe('mistral');
      expect(strategy.priority).toBe(85);
      expect(strategy.getSelectors()).toEqual([
        '.ProseMirror[contenteditable="true"]',
        'div.ProseMirror[data-placeholder*="Ask"]',
        '[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"]',
        'textarea',
        '[role="textbox"]'
      ]);
    });
  });

  describe('canHandle', () => {
    it('should return true for elements on chat.mistral.ai', () => {
      expect(strategy.canHandle(mockElement)).toBe(true);
    });

    it('should return false for elements not on chat.mistral.ai', () => {
      mockLocation.hostname = 'example.com';
      const newStrategy = new MistralStrategy();
      expect(newStrategy.canHandle(mockElement)).toBe(false);
    });
  });

  describe('getSelectors', () => {
    it('should return Mistral-specific selectors', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toContain('.ProseMirror[contenteditable="true"]');
      expect(selectors).toContain('div.ProseMirror[data-placeholder*="Ask"]');
    });
  });

  describe('createIcon', () => {
    it('should create Mistral-specific icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);

      expect(mockUIFactory.createMistralIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'click').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);

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

    it('should attempt ProseMirror paragraph insertion first', async () => {
      const pElement = document.createElement('p');
      mockElement.appendChild(pElement);

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-prosemirror-p');
      expect(pElement.innerHTML).toBe('test content');
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

    it('should fall back to execCommand when ProseMirror methods fail', async () => {
      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-execCommand');
      expect((document as any).execCommand).toHaveBeenCalledWith('insertText', false, 'test content');
    });

    it('should fall back to DOM manipulation when execCommand fails', async () => {
      (document as any).execCommand = vi.fn().mockReturnValue(false);

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('mistral-dom-manipulation');
      expect(mockElement.textContent).toBe('test content');
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });
      (document as any).execCommand = vi.fn().mockImplementation(() => {
        throw new Error('ExecCommand failed');
      });

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should trigger Mistral-specific events', async () => {
      await strategy.insert(mockElement, 'test content');

      expect(mockElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true
        })
      );
    });
  });

  describe('_findProseMirrorElement', () => {
    it('should return element if it is already ProseMirror', () => {
      const proseMirrorElement = document.createElement('div');
      proseMirrorElement.classList.add('ProseMirror');

      const result = (strategy as any)._findProseMirrorElement(proseMirrorElement);
      expect(result).toBe(proseMirrorElement);
    });

    it('should find ProseMirror parent', () => {
      const parentElement = document.createElement('div');
      parentElement.classList.add('ProseMirror');
      const childElement = document.createElement('span');
      parentElement.appendChild(childElement);

      const result = (strategy as any)._findProseMirrorElement(childElement);
      expect(result).toBe(parentElement);
    });

    it('should find ProseMirror child', () => {
      const parentElement = document.createElement('div');
      const childElement = document.createElement('div');
      childElement.classList.add('ProseMirror');
      parentElement.appendChild(childElement);

      const result = (strategy as any)._findProseMirrorElement(parentElement);
      expect(result).toBe(childElement);
    });

    it('should find any ProseMirror element on page as fallback', () => {
      const proseMirrorElement = document.createElement('div');
      proseMirrorElement.contentEditable = 'true';
      proseMirrorElement.classList.add('ProseMirror');
      document.body.appendChild(proseMirrorElement);

      const originalQuerySelector = document.querySelector;
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '.ProseMirror[contenteditable="true"]') {
          return proseMirrorElement;
        }
        return originalQuerySelector.call(document, selector);
      });

      const randomElement = document.createElement('div');
      const result = (strategy as any)._findProseMirrorElement(randomElement);
      expect(result).toBe(proseMirrorElement);

      document.body.removeChild(proseMirrorElement);
      vi.restoreAllMocks();
    });

    it('should return original element as final fallback', () => {
      const element = document.createElement('div');
      const result = (strategy as any)._findProseMirrorElement(element);
      expect(result).toBe(element);
    });
  });
});