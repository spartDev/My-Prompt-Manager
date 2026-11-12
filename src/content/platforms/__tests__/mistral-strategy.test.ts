import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorCommand, MULTILINE_PROMPT } from '../../../test/helpers/editor-command';
import { expectNoMarkupIn, HOSTILE_TEXTS } from '../../../test/helpers/hostile-text';
import { readInputText } from '../../selector/inputText';
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
      expect(strategy.name).toBe('Mistral');
      expect(strategy.priority).toBe(85);
      expect(strategy.getSelectors()).toEqual([
        'div[contenteditable="true"]',
        'textarea[placeholder*="chat"]',
        '[role="textbox"]'
      ]);
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

  describe('insert - into the ProseMirror editor', () => {
    beforeEach(() => {
      document.body.appendChild(mockElement);
      // An empty editor, with no caret in it
      mockElement.innerHTML = '<p><br></p>';
      document.getSelection()?.removeAllRanges();
    });

    afterEach(() => {
      mockElement.remove();
    });

    it('goes through the editing command, so the editor builds a paragraph per line', async () => {
      document.execCommand = editorCommand(mockElement);

      const result = await strategy.insert(mockElement, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'mistral-execCommand' });
      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, MULTILINE_PROMPT);
      expect(readInputText(mockElement)).toBe(MULTILINE_PROMPT);
      expect(Array.from(mockElement.children).map((child) => child.textContent)).toEqual([
        '  You are a reviewer.', 'End with a verdict.', '', 'Diff:', ''
      ]);
    });

    it('does not write the Prompt into the first paragraph, where an editor reads line breaks as spaces', async () => {
      document.execCommand = editorCommand(mockElement);
      const firstParagraph = mockElement.querySelector('p');

      await strategy.insert(mockElement, MULTILINE_PROMPT);

      expect(firstParagraph?.isConnected).toBe(false);
      expect(mockElement.querySelector('p')?.textContent).not.toContain('\n');
    });

    it('finds the editor from an element inside it', async () => {
      document.execCommand = editorCommand(mockElement);
      const paragraph = mockElement.querySelector('p') as HTMLElement;

      const result = await strategy.insert(paragraph, MULTILINE_PROMPT);

      expect(result.success).toBe(true);
      expect(readInputText(mockElement)).toBe(MULTILINE_PROMPT);
    });

    it('writes the lines itself, one <br> between two, when the editing command is refused', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);

      const result = await strategy.insert(mockElement, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'mistral-dom' });
      expect(readInputText(mockElement)).toBe(MULTILINE_PROMPT);
      expect(mockElement.querySelectorAll('br').length).toBeGreaterThan(0);
    });

    it('tells the page of a direct write with an input event', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);
      const heard = vi.fn();
      mockElement.addEventListener('input', heard);

      await strategy.insert(mockElement, 'test content');

      expect(heard).toHaveBeenCalledTimes(1);
      expect((heard.mock.calls[0][0] as InputEvent).inputType).toBe('insertText');
    });

    it('fails when the editor does not keep the text', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);
      mockElement.addEventListener('input', () => {
        mockElement.textContent = 'rewritten by the page';
      });

      const result = await strategy.insert(mockElement, MULTILINE_PROMPT);

      expect(result.success).toBe(false);
    });

    it('does not shorten long content', async () => {
      document.execCommand = editorCommand(mockElement);
      const longContent = 'a'.repeat(60000);

      const result = await strategy.insert(mockElement, longContent);

      expect(result.success).toBe(true);
      expect(readInputText(mockElement)).toBe(longContent);
    });

    it('leaves control and invisible characters as given', async () => {
      document.execCommand = editorCommand(mockElement);
      const content = 'a\u{0}b\u{200B}c\u{200D}d';

      await strategy.insert(mockElement, content);

      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, content);
      expect(readInputText(mockElement)).toBe(content);
    });

    it('leaves the field as it is for empty content', async () => {
      document.execCommand = editorCommand(mockElement);
      mockElement.innerHTML = '<p>what the field held</p>';

      const result = await strategy.insert(mockElement, '');

      expect(result.success).toBe(true);
      expect(readInputText(mockElement)).toBe('what the field held');
    });
  });

  describe.each(HOSTILE_TEXTS)('hostile-looking text %j', (text) => {
    beforeEach(() => {
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      mockElement.remove();
    });

    it('goes to the editing command as the same text', async () => {
      document.execCommand = editorCommand(mockElement);

      await strategy.insert(mockElement, text);

      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, text);
      expect(readInputText(mockElement)).toBe(text);
      // The paragraph is the stand-in editor's own structure
      expectNoMarkupIn(mockElement, ['p']);
    });

    it('is written as text when the editor is filled directly', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);

      await strategy.insert(mockElement, text);

      expect(readInputText(mockElement)).toBe(text);
      expectNoMarkupIn(mockElement);
    });

  });

  describe('insert - other elements', () => {
    it.each(HOSTILE_TEXTS)('sets hostile-looking text %j as the value of a textarea', async (text) => {
      const textarea = document.createElement('textarea');

      await strategy.insert(textarea, text);

      expect(textarea.value).toBe(text);
    });

    it('sets the value of a textarea and tells the page', async () => {
      const textarea = document.createElement('textarea');
      const heard = vi.fn();
      textarea.addEventListener('input', heard);
      textarea.addEventListener('change', heard);

      const result = await strategy.insert(textarea, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'mistral-textarea' });
      expect(textarea.value).toBe(MULTILINE_PROMPT);
      expect(heard).toHaveBeenCalledTimes(2);
    });

    it('fails on an element that holds no editable text', async () => {
      const plain = document.createElement('div');
      plain.setAttribute('role', 'textbox');

      const result = await strategy.insert(plain, 'test content');

      expect(result.success).toBe(false);
    });

    it('fails without throwing when the editor throws', async () => {
      document.body.appendChild(mockElement);
      document.execCommand = vi.fn(() => {
        throw new Error('editor broke');
      });

      const result = await strategy.insert(mockElement, 'test content');

      expect(result.success).toBe(false);
      mockElement.remove();
    });
  });
});
