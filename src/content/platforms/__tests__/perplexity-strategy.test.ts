/**
 * Unit tests for PerplexityStrategy
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorCommand, MULTILINE_PROMPT } from '../../../test/helpers/editor-command';
import { expectNoMarkupIn, HOSTILE_TEXTS } from '../../../test/helpers/hostile-text';
import { actAsLexicalEditor } from '../../../test/helpers/lexical-editor';
import { readInputText, textBeforeCaret } from '../../selector/inputText';
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

  describe('insert - into the Lexical editor', () => {
    let editor: HTMLElement;

    beforeEach(() => {
      editor = mockContentEditableDiv;
      editor.setAttribute('contenteditable', 'true');
      document.body.appendChild(editor);
      document.execCommand = vi.fn(actAsLexicalEditor(editor));
    });

    afterEach(() => {
      editor.remove();
    });

    it('puts the Prompt in once', async () => {
      const result = await strategy.insert(editor, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'perplexity-paste' });
      expect(readInputText(editor)).toBe(MULTILINE_PROMPT);
    });

    it('sends no input event carrying the text, which the editor would insert a second time', async () => {
      const heard: string[] = [];
      editor.addEventListener('input', (event) => {
        heard.push(String((event as InputEvent).data));
      });

      await strategy.insert(editor, 'one line');

      expect(heard).toEqual([]);
      expect(editor.textContent).toBe('one line');
    });

    it('does not use the editing command, which drops the line breaks', async () => {
      await strategy.insert(editor, MULTILINE_PROMPT);

      expect(document.execCommand).not.toHaveBeenCalledWith('insertText', false, expect.anything());
    });

    it('keeps each line of the Prompt, one <br> between two', async () => {
      await strategy.insert(editor, MULTILINE_PROMPT);

      expect(Array.from(editor.querySelectorAll('span')).map((span) => span.textContent)).toEqual([
        '  You are a reviewer.', 'End with a verdict.', 'Diff:'
      ]);
      expect(editor.querySelectorAll('br')).toHaveLength(5);
    });

    it('pastes where the caret is: the text before and after stays, and the caret ends after the Prompt', async () => {
      await strategy.insert(editor, 'before after');
      document.getSelection()?.collapse(editor.querySelector('span')?.firstChild as Text, 7);

      const result = await strategy.insert(editor, 'one\n\ntwo ');

      expect(result).toEqual({ success: true, method: 'perplexity-paste' });
      expect(readInputText(editor)).toBe('before one\n\ntwo after');
      expect(textBeforeCaret(editor)).toBe('before one\n\ntwo ');
    });

    it('pastes over the selected text', async () => {
      await strategy.insert(editor, 'before selected after');
      const text = editor.querySelector('span')?.firstChild as Text;
      document.getSelection()?.setBaseAndExtent(text, 7, text, 15);

      await strategy.insert(editor, 'PROMPT');

      expect(readInputText(editor)).toBe('before PROMPT after');
    });

    it('pastes after what the field holds when the caret is not in the field', async () => {
      await strategy.insert(editor, 'draft');
      document.getSelection()?.removeAllRanges();
      let caret: { container: Node; offset: number } | undefined;
      editor.addEventListener('paste', () => {
        const range = document.getSelection()?.getRangeAt(0);
        if (range?.collapsed) {
          caret = { container: range.startContainer, offset: range.startOffset };
        }
      }, { capture: true });
      const paragraph = editor.querySelector('p') as HTMLElement;

      await strategy.insert(editor, ' PROMPT');

      expect(readInputText(editor)).toBe('draft PROMPT');
      // Inside the last block, where the editor has a caret
      expect(caret).toEqual({ container: paragraph, offset: 1 });
    });

    it('changes nothing for empty content', async () => {
      await strategy.insert(editor, 'draft');
      const pasted = vi.fn();
      editor.addEventListener('paste', pasted);

      const result = await strategy.insert(editor, '');

      expect(result.success).toBe(true);
      expect(readInputText(editor)).toBe('draft');
      expect(pasted).not.toHaveBeenCalled();
    });

    it('fails, and writes nothing more, when the editor took the paste but holds another text', async () => {
      editor.addEventListener('paste', () => {
        editor.querySelector('p')?.append('!');
      });

      const result = await strategy.insert(editor, 'one line');

      expect(result.success).toBe(false);
      expect(editor.textContent).toBe('one line!');
      expect(document.execCommand).not.toHaveBeenCalledWith('insertText', false, expect.anything());
    });

    it('takes a non-breaking space the editor shows for a space of the Prompt as the same text', async () => {
      editor.addEventListener('paste', () => {
        const span = editor.querySelector('span');
        if (span) {
          span.textContent = (span.textContent ?? '').replace(/ $/, '\u00a0');
        }
      });

      const result = await strategy.insert(editor, 'ends with a space ');

      expect(result).toEqual({ success: true, method: 'perplexity-paste' });
    });

    it('fails when the editor turns a non-breaking space of the Prompt into a space', async () => {
      editor.addEventListener('paste', () => {
        const span = editor.querySelector('span');
        if (span) {
          span.textContent = (span.textContent ?? '').replace(/\u00a0/g, ' ');
        }
      });

      const result = await strategy.insert(editor, 'kept\u00a0together');

      expect(result.success).toBe(false);
    });

    it.each(HOSTILE_TEXTS)('inserts hostile-looking text %j as text', async (text) => {
      await strategy.insert(editor, text);

      expect(readInputText(editor)).toBe(text);
      // Paragraph and span are the stand-in editor's own structure
      expectNoMarkupIn(editor, ['p', 'span', 'br']);
    });
  });

  describe('restore - Undo in the Lexical editor', () => {
    let editor: HTMLElement;

    beforeEach(() => {
      editor = mockContentEditableDiv;
      editor.setAttribute('contenteditable', 'true');
      document.body.appendChild(editor);
      document.execCommand = vi.fn(actAsLexicalEditor(editor));
    });

    afterEach(() => {
      editor.remove();
    });

    it('replaces what the field holds, the line breaks that end it included', async () => {
      await strategy.insert(editor, 'draft\n\n\n');

      await strategy.restore(editor, 'one line');

      expect(readInputText(editor)).toBe('one line');
      expect(editor.querySelectorAll('br')).toHaveLength(0);
    });

    it('selects from the start of the first block to the end of the last one before pasting', async () => {
      await strategy.insert(editor, 'draft\n\n');
      const paragraph = editor.querySelector('p') as HTMLElement;
      let selected: { start: Node; startOffset: number; end: Node; endOffset: number } | undefined;
      editor.addEventListener('paste', () => {
        const range = document.getSelection()?.getRangeAt(0);
        if (range) {
          selected = { start: range.startContainer, startOffset: range.startOffset, end: range.endContainer, endOffset: range.endOffset };
        }
      }, { capture: true });

      await strategy.restore(editor, 'one line');

      expect(selected).toEqual({ start: paragraph, startOffset: 0, end: paragraph, endOffset: 4 });
    });

    it('puts a draft of several lines back, line for line', async () => {
      await strategy.insert(editor, MULTILINE_PROMPT);

      const result = await strategy.restore(editor, 'my draft\n\nsecond paragraph');

      expect(result).toEqual({ success: true, method: 'restore-paste' });
      expect(readInputText(editor)).toBe('my draft\n\nsecond paragraph');
    });

    it('empties the field when it held nothing before the Insertion', async () => {
      await strategy.insert(editor, MULTILINE_PROMPT);

      const result = await strategy.restore(editor, '');

      expect(result.success).toBe(true);
      expect(readInputText(editor)).toBe('');
      expect(document.execCommand).not.toHaveBeenCalledWith('delete');
    });

    it('touches nothing when the field already holds the text', async () => {
      await strategy.insert(editor, 'one line');
      const pasted = vi.fn();
      editor.addEventListener('paste', pasted);

      const result = await strategy.restore(editor, 'one line');

      expect(result).toEqual({ success: true, method: 'restore-unchanged' });
      expect(pasted).not.toHaveBeenCalled();
    });
  });

  describe('insert - where nothing takes a paste', () => {
    it('goes through the editing command in a plain contenteditable', async () => {
      const plain = document.createElement('div');
      plain.setAttribute('contenteditable', 'true');
      document.body.appendChild(plain);
      document.execCommand = editorCommand(plain);

      const result = await strategy.insert(plain, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'perplexity-execCommand' });
      expect(readInputText(plain)).toBe(MULTILINE_PROMPT);
      plain.remove();
    });

    it('writes the lines itself when there is no editing command either', async () => {
      const plain = document.createElement('div');
      plain.setAttribute('contenteditable', 'true');
      document.body.appendChild(plain);
      document.execCommand = vi.fn().mockReturnValue(false);

      const result = await strategy.insert(plain, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'perplexity-dom' });
      expect(readInputText(plain)).toBe(MULTILINE_PROMPT);
      plain.remove();
    });

    it('sets the value of a textarea and tells the page', async () => {
      const heard = vi.fn();
      mockTextarea.addEventListener('input', heard);
      mockTextarea.addEventListener('change', heard);

      const result = await strategy.insert(mockTextarea, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'perplexity-value' });
      expect(mockTextarea.value).toBe(MULTILINE_PROMPT);
      expect(heard).toHaveBeenCalledTimes(2);
    });

    it('fails when the page rewrites the value of the textarea', async () => {
      mockTextarea.addEventListener('input', () => {
        mockTextarea.value = 'rewritten by the page';
      });

      const result = await strategy.insert(mockTextarea, MULTILINE_PROMPT);

      expect(result.success).toBe(false);
    });

    it('fails on an element that holds no editable text', async () => {
      const result = await strategy.insert(document.createElement('div'), 'test content');

      expect(result.success).toBe(false);
    });

    it('fails without throwing when the page throws', async () => {
      const plain = document.createElement('div');
      plain.setAttribute('contenteditable', 'true');
      document.body.appendChild(plain);
      document.execCommand = vi.fn(() => {
        throw new Error('editor broke');
      });

      const result = await strategy.insert(plain, 'test content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('editor broke');
      plain.remove();
    });
  });
});
