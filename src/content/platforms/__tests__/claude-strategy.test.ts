/**
 * Unit tests for ClaudeStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { ClaudeStrategy } from '../claude-strategy';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  Logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock window.location.hostname
const mockLocation = {
  hostname: 'claude.ai'
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('ClaudeStrategy', () => {
  let strategy: ClaudeStrategy;
  let mockElement: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new ClaudeStrategy();
    mockElement = document.createElement('div');
    mockElement.contentEditable = 'true';
    mockElement.setAttribute('role', 'textbox');
    mockElement.classList.add('ProseMirror');

    mockUIFactory = {
      createClaudeIcon: vi.fn().mockReturnValue({
        container: document.createElement('div'),
        icon: document.createElement('button')
      })
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create Claude strategy with correct configuration', () => {
      expect(strategy.name).toBe('claude');
      expect(strategy.priority).toBe(100);
      expect(strategy.getSelectors()).toEqual([
        'div[contenteditable="true"][role="textbox"].ProseMirror'
      ]);
    });
  });

  describe('canHandle', () => {
    it('should return true for elements on claude.ai', () => {
      expect(strategy.canHandle(mockElement)).toBe(true);
    });

    it('should return false for elements not on claude.ai', () => {
      mockLocation.hostname = 'example.com';
      const newStrategy = new ClaudeStrategy();
      expect(newStrategy.canHandle(mockElement)).toBe(false);
    });
  });

  describe('getSelectors', () => {
    it('should return Claude-specific selectors', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toEqual([
        'div[contenteditable="true"][role="textbox"].ProseMirror'
      ]);
    });
  });

  describe('createIcon', () => {
    it('should create Claude-specific icon using UI factory', () => {
      const icon = strategy.createIcon(mockUIFactory);
      
      expect(mockUIFactory.createClaudeIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      // Mock DOM methods
      vi.spyOn(mockElement, 'focus').mockImplementation(() => {});
      vi.spyOn(mockElement, 'click').mockImplementation(() => {});
      vi.spyOn(mockElement, 'dispatchEvent').mockImplementation(() => true);
      
      // Mock execCommand on document
      (document as any).execCommand = vi.fn().mockReturnValue(true);
      
      // Mock window.getSelection
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn()
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);
      
      // Mock document.createRange
      const mockRange = {
        selectNodeContents: vi.fn()
      };
      vi.spyOn(document, 'createRange').mockReturnValue(mockRange as any);
    });

    it('should attempt ProseMirror transaction first', async () => {
      // Mock ProseMirror view
      const mockView = {
        state: {
          tr: {
            insertText: vi.fn().mockReturnValue({})
          },
          selection: { from: 0, to: 0 }
        },
        dispatch: vi.fn()
      };
      
      (mockElement as any).pmViewDesc = { view: mockView };
      
      const result = await strategy.insert(mockElement, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('prosemirror-transaction');
      expect(mockView.state.tr.insertText).toHaveBeenCalledWith('test content', 0, 0);
      expect(mockView.dispatch).toHaveBeenCalled();
    });

    it('should fall back to execCommand when ProseMirror transaction fails', async () => {
      const result = await strategy.insert(mockElement, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('execCommand');
      expect((document as any).execCommand).toHaveBeenCalledWith('insertText', false, 'test content');
    });

    it('should fall back to DOM manipulation when execCommand fails', async () => {
      (document as any).execCommand = vi.fn().mockReturnValue(false);
      
      const result = await strategy.insert(mockElement, 'test content');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('dom-manipulation');
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

    it('should find ProseMirror element correctly', async () => {
      // Test with element that has ProseMirror child
      const parentElement = document.createElement('div');
      const proseMirrorChild = document.createElement('div');
      proseMirrorChild.classList.add('ProseMirror');
      proseMirrorChild.contentEditable = 'true';
      parentElement.appendChild(proseMirrorChild);
      
      vi.spyOn(proseMirrorChild, 'focus').mockImplementation(() => {});
      vi.spyOn(proseMirrorChild, 'click').mockImplementation(() => {});
      vi.spyOn(proseMirrorChild, 'dispatchEvent').mockImplementation(() => true);
      
      const result = await strategy.insert(parentElement, 'test content');
      
      expect(result.success).toBe(true);
    });

    it('should trigger Claude-specific events', async () => {
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
      proseMirrorElement.setAttribute('role', 'textbox');
      proseMirrorElement.classList.add('ProseMirror');
      document.body.appendChild(proseMirrorElement);
      
      // Mock querySelector to return our element
      const originalQuerySelector = document.querySelector;
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === 'div[contenteditable="true"][role="textbox"].ProseMirror') {
          return proseMirrorElement;
        }
        return originalQuerySelector.call(document, selector);
      });
      
      const randomElement = document.createElement('div');
      const result = (strategy as any)._findProseMirrorElement(randomElement);
      expect(result).toBe(proseMirrorElement);
      
      // Cleanup
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