/**
 * Unit tests for M365CopilotStrategy
 *
 * Microsoft 365 Copilot is served at m365.cloud.microsoft and at copilot.cloud.microsoft, where a
 * work account is redirected. Its composer is a Lexical editor: an Insertion goes in as one paste,
 * and is never written a second time (the double write of ticket My-Prompt-Manager-e66 on
 * Perplexity's Lexical editor). The paste itself is tested at length in perplexity-strategy.test.ts,
 * which runs the same LexicalStrategy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SUPPORTED_PLATFORMS } from '../../../config/platforms';
import { editorCommand, MULTILINE_PROMPT } from '../../../test/helpers/editor-command';
import { expectNoMarkupIn, HOSTILE_TEXTS } from '../../../test/helpers/hostile-text';
import { actAsLexicalEditor } from '../../../test/helpers/lexical-editor';
import { readInputText } from '../../selector/inputText';
import { M365CopilotStrategy } from '../m365copilot-strategy';

import { createMockUIFactory, setMockHostname } from './fixtures/shared-fixtures';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

setMockHostname('copilot.cloud.microsoft');

/** The editor read on copilot.cloud.microsoft/chat, signed in, on 2026-11-15 */
function liveEditor(): HTMLElement {
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  editor.setAttribute('data-lexical-editor', 'true');
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', 'Message Copilot');
  return editor;
}

describe('M365CopilotStrategy', () => {
  let strategy: M365CopilotStrategy;

  beforeEach(() => {
    strategy = new M365CopilotStrategy('copilot.cloud.microsoft');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('takes its name, priority and selectors from the m365copilot Platform', () => {
      expect(strategy.name).toBe('m365copilot');
      expect(strategy.priority).toBe(80);
      expect(strategy.getSelectors()).toEqual(SUPPORTED_PLATFORMS.m365copilot.selectors);
    });

    it('finds the Lexical editor of copilot.cloud.microsoft with its selectors', () => {
      const editor = liveEditor();
      document.body.appendChild(editor);

      expect(strategy.getSelectors().some((selector) => editor.matches(selector))).toBe(true);
    });

    it('creates the Copilot icon', () => {
      const factory = createMockUIFactory();

      const icon = strategy.createIcon(factory);

      expect(factory.createCopilotIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });
  });

  describe('canHandle', () => {
    it.each(['copilot.cloud.microsoft', 'm365.cloud.microsoft'])('handles the editor and a textarea on %s', (hostname) => {
      const onHost = new M365CopilotStrategy(hostname);

      expect(onHost.canHandle(liveEditor())).toBe(true);
      expect(onHost.canHandle(document.createElement('textarea'))).toBe(true);
      expect(onHost.canHandle(document.createElement('div'))).toBe(false);
    });

    it.each(['copilot.microsoft.com', 'claude.ai', 'cloud.microsoft'])('does not handle %s', (hostname) => {
      expect(new M365CopilotStrategy(hostname).canHandle(liveEditor())).toBe(false);
    });
  });

  describe('insert - into the Lexical editor', () => {
    let editor: HTMLElement;

    beforeEach(() => {
      editor = liveEditor();
      document.body.appendChild(editor);
      document.execCommand = vi.fn(actAsLexicalEditor(editor));
    });

    it('puts the Prompt in once, Verbatim, line for line', async () => {
      const result = await strategy.insert(editor, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'm365copilot-paste' });
      expect(readInputText(editor)).toBe(MULTILINE_PROMPT);
      expect(document.execCommand).not.toHaveBeenCalledWith('insertText', false, expect.anything());
    });

    it('sends no input event, which the editor would take as the text a second time', async () => {
      const heard = vi.fn();
      editor.addEventListener('input', heard);
      editor.addEventListener('change', heard);

      await strategy.insert(editor, 'one line');

      expect(heard).not.toHaveBeenCalled();
      expect(editor.textContent).toBe('one line');
    });

    it('fails, and writes nothing more, when the editor took the paste but holds another text', async () => {
      editor.addEventListener('paste', () => {
        editor.querySelector('p')?.append('!');
      });

      const result = await strategy.insert(editor, 'one line');

      expect(result.success).toBe(false);
      expect(editor.textContent).toBe('one line!');
    });

    it.each(HOSTILE_TEXTS)('inserts hostile-looking text %j as text', async (text) => {
      await strategy.insert(editor, text);

      expect(readInputText(editor)).toBe(text);
      expectNoMarkupIn(editor, ['p', 'span', 'br']);
    });

    it('puts the draft back on Undo, line for line', async () => {
      await strategy.insert(editor, MULTILINE_PROMPT);

      const result = await strategy.restore(editor, 'my draft\n\nsecond paragraph');

      expect(result).toEqual({ success: true, method: 'restore-paste' });
      expect(readInputText(editor)).toBe('my draft\n\nsecond paragraph');
    });
  });

  describe('insert - where nothing takes a paste', () => {
    it('goes through the editing command in a plain contenteditable', async () => {
      const plain = liveEditor();
      document.body.appendChild(plain);
      document.execCommand = editorCommand(plain);

      const result = await strategy.insert(plain, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'm365copilot-execCommand' });
      expect(readInputText(plain)).toBe(MULTILINE_PROMPT);
    });

    it('sets the value of a textarea and tells the page', async () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      const heard = vi.fn();
      textarea.addEventListener('input', heard);

      const result = await strategy.insert(textarea, MULTILINE_PROMPT);

      expect(result).toEqual({ success: true, method: 'm365copilot-value' });
      expect(textarea.value).toBe(MULTILINE_PROMPT);
      expect(heard).toHaveBeenCalled();
    });

    it('fails on an element that holds no editable text', async () => {
      const result = await strategy.insert(document.createElement('div'), 'test content');

      expect(result.success).toBe(false);
    });
  });
});
