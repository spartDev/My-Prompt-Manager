/**
 * Unit tests for ClaudeStrategy
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorCommand } from '../../../test/helpers/editor-command';
import { expectNoMarkupIn, HOSTILE_TEXTS } from '../../../test/helpers/hostile-text';
import { readInputText } from '../../selector/inputText';
import type { UIElementFactory } from '../../ui/element-factory';
import { ClaudeStrategy } from '../claude-strategy';

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
      createClaudeIcon: vi.fn().mockReturnValue(document.createElement('button'))
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
      vi.spyOn(mockElement, 'focus').mockImplementation(() => undefined);
      vi.spyOn(mockElement, 'click').mockImplementation(() => undefined);
      document.body.appendChild(mockElement);
      document.getSelection()?.removeAllRanges();
      document.execCommand = editorCommand(mockElement);
    });

    afterEach(() => {
      mockElement.remove();
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
      expect(result.method).toBe('claude-execCommand');
      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'test content');
      expect(readInputText(mockElement)).toBe('test content');
    });

    it('should write the text itself when execCommand fails', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(true);
      expect(result.method).toBe('claude-dom');
      expect(mockElement.textContent).toBe('test content');
    });

    it('fails, and writes nothing over the field, when the editor keeps neither', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);
      mockElement.textContent = 'what the field held';
      mockElement.addEventListener('input', () => {
        mockElement.textContent = 'what the field held';
      });

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(false);
      expect(mockElement.textContent).toBe('what the field held');
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
      document.body.appendChild(parentElement);
      document.execCommand = editorCommand(proseMirrorChild);

      const result = await strategy.insert(parentElement, 'test content');

      expect(result.success).toBe(true);
      expect(readInputText(proseMirrorChild)).toBe('test content');
      parentElement.remove();
    });

    it('should trigger Claude-specific events', async () => {
      const heard: string[] = [];
      mockElement.addEventListener('input', () => heard.push('input'));
      mockElement.addEventListener('compositionend', () => heard.push('compositionend'));

      await strategy.insert(mockElement, 'test content');

      expect(heard).toEqual(['input', 'compositionend']);
    });
  });

  describe.each(HOSTILE_TEXTS)('hostile-looking text %j', (text) => {
    beforeEach(() => {
      vi.spyOn(mockElement, 'focus').mockImplementation(() => undefined);
      vi.spyOn(mockElement, 'click').mockImplementation(() => undefined);
      document.body.appendChild(mockElement);
      document.getSelection()?.removeAllRanges();
    });

    afterEach(() => {
      mockElement.remove();
    });

    it('goes to the ProseMirror transaction as the same text', async () => {
      const mockView = {
        state: { tr: { insertText: vi.fn().mockReturnValue({}) }, selection: { from: 0, to: 0 } },
        dispatch: vi.fn()
      };
      (mockElement as any).pmViewDesc = { view: mockView };

      const result = await strategy.insert(mockElement, text);

      expect(result.method).toBe('prosemirror-transaction');
      expect(mockView.state.tr.insertText).toHaveBeenCalledWith(text, 0, 0);
      expectNoMarkupIn(mockElement);
    });

    it('goes to execCommand as the same text', async () => {
      document.execCommand = editorCommand(mockElement);

      const result = await strategy.insert(mockElement, text);

      expect(result.method).toBe('claude-execCommand');
      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, text);
      expect(readInputText(mockElement)).toBe(text);
      // The paragraph is the stand-in editor's own structure
      expectNoMarkupIn(mockElement, ['p']);
    });

    it('is set as the text of the editor when it is filled directly', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);

      const result = await strategy.insert(mockElement, text);

      expect(result.method).toBe('claude-dom');
      expect(mockElement.textContent).toBe(text);
      expectNoMarkupIn(mockElement);
    });
  });
});
