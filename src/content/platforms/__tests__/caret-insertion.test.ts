/**
 * An Insertion puts the Prompt where the caret is (CONTEXT.md, Insertion), on every Platform:
 * the text before and after the caret stays, selected text is replaced, a field with no caret
 * takes the Prompt at its end, and Undo still puts back the text the field held.
 *
 * Each strategy is run on the kinds of input field it handles. The rich text editor is the
 * stand-in of src/test/helpers/editor-command.ts: it takes text through the editing command,
 * where the selection is. What only a real browser and a real editor show is proved in
 * tests/e2e/content/caret-insertion.spec.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorCommand } from '../../../test/helpers/editor-command';
import { readInputText, textBeforeCaret } from '../../selector/inputText';
import type { PlatformStrategy } from '../base-strategy';
import { ChatGPTStrategy } from '../chatgpt-strategy';
import { ClaudeStrategy } from '../claude-strategy';
import { CopilotStrategy } from '../copilot-strategy';
import { GeminiStrategy } from '../gemini-strategy';
import { M365CopilotStrategy } from '../m365copilot-strategy';
import { MistralStrategy } from '../mistral-strategy';
import { PerplexityStrategy } from '../perplexity-strategy';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

const textarea = (attributes: Record<string, string> = {}) => (): HTMLTextAreaElement => {
  const field = document.createElement('textarea');
  for (const [name, value] of Object.entries(attributes)) {
    field.setAttribute(name, value);
  }
  return field;
};

/** A contenteditable element, as the Platform's composer has it. */
const editable = (tag: string, attributes: Record<string, string> = {}) => (): HTMLElement => {
  const field = document.createElement(tag);
  field.setAttribute('contenteditable', 'true');
  field.contentEditable = 'true';
  for (const [name, value] of Object.entries(attributes)) {
    field.setAttribute(name, value);
  }
  return field;
};

interface PlatformCase {
  platform: string;
  strategy: () => PlatformStrategy;
  textarea?: () => HTMLTextAreaElement;
  editor?: () => HTMLElement;
}

const PLATFORMS: PlatformCase[] = [
  {
    platform: 'Claude',
    strategy: () => new ClaudeStrategy('claude.ai'),
    editor: editable('div', { class: 'ProseMirror', role: 'textbox' })
  },
  {
    platform: 'ChatGPT',
    strategy: () => new ChatGPTStrategy('chatgpt.com'),
    textarea: textarea(),
    editor: editable('div', { class: 'ProseMirror' })
  },
  {
    platform: 'Mistral',
    strategy: () => new MistralStrategy('chat.mistral.ai'),
    textarea: textarea({ placeholder: 'Ask le chat' }),
    editor: editable('div', { class: 'ProseMirror' })
  },
  {
    platform: 'Gemini',
    strategy: () => new GeminiStrategy('gemini.google.com'),
    editor: editable('div', { class: 'ql-editor', role: 'textbox' })
  },
  {
    // Where nothing takes a paste. Its Lexical editor is in perplexity-strategy.test.ts
    platform: 'Perplexity',
    strategy: () => new PerplexityStrategy('www.perplexity.ai'),
    textarea: textarea(),
    editor: editable('div', { id: 'ask-input', role: 'textbox' })
  },
  {
    platform: 'Copilot',
    strategy: () => new CopilotStrategy('copilot.microsoft.com'),
    textarea: textarea({ 'data-testid': 'composer-input' })
  },
  {
    platform: 'M365 Copilot',
    strategy: () => new M365CopilotStrategy('m365.cloud.microsoft'),
    textarea: textarea({ placeholder: 'Message Copilot' }),
    editor: editable('span', { id: 'm365-chat-editor-target-element', 'data-lexical-editor': 'true', role: 'combobox' })
  }
];

describe.each(PLATFORMS)('$platform: an Insertion goes where the caret is', ({ strategy, textarea: makeTextarea, editor: makeEditor }) => {
  if (makeTextarea) {
    describe('in its textarea', () => {
      let field: HTMLTextAreaElement;

      beforeEach(() => {
        field = makeTextarea();
        document.body.appendChild(field);
        field.value = 'before selected after';
      });

      afterEach(() => {
        field.remove();
      });

      it('handles the field', () => {
        expect(strategy().canHandle(field)).toBe(true);
      });

      it('keeps the text before and after the caret, and leaves the caret after the Prompt', async () => {
        field.setSelectionRange(7, 7);

        const result = await strategy().insert(field, 'PROMPT ');

        expect(result.success).toBe(true);
        expect(field.value).toBe('before PROMPT selected after');
        expect([field.selectionStart, field.selectionEnd]).toEqual([14, 14]);
      });

      it('replaces the selected text', async () => {
        field.setSelectionRange(7, 15);

        const result = await strategy().insert(field, 'PROMPT');

        expect(result.success).toBe(true);
        expect(field.value).toBe('before PROMPT after');
      });

      it('tells the page, as typing would', async () => {
        const heard: string[] = [];
        field.addEventListener('input', () => heard.push('input'));
        field.addEventListener('change', () => heard.push('change'));
        field.setSelectionRange(7, 7);

        await strategy().insert(field, 'PROMPT ');

        expect(heard).toEqual(['input', 'change']);
      });

      it('Undo puts back the text the field held', async () => {
        const held = field.value;
        field.setSelectionRange(7, 15);
        await strategy().insert(field, 'PROMPT');

        const result = await strategy().restore(field, held);

        expect(result.success).toBe(true);
        expect(field.value).toBe(held);
      });
    });
  }

  if (makeEditor) {
    describe('in its rich text editor', () => {
      let field: HTMLElement;

      /** Puts the caret, or a selection, in the text of the editor's only paragraph. */
      const select = (start: number, end = start): void => {
        const text = field.querySelector('p')?.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, end);
        const selection = document.getSelection() as Selection;
        selection.removeAllRanges();
        selection.addRange(range);
      };

      beforeEach(() => {
        field = makeEditor();
        field.innerHTML = '<p>before selected after</p>';
        document.body.appendChild(field);
        document.getSelection()?.removeAllRanges();
        document.execCommand = editorCommand(field);
      });

      afterEach(() => {
        field.remove();
      });

      it('handles the field', () => {
        expect(strategy().canHandle(field)).toBe(true);
      });

      it('keeps the text before and after the caret, and leaves the caret after the Prompt', async () => {
        select(7);

        const result = await strategy().insert(field, 'PROMPT ');

        expect(result.success).toBe(true);
        expect(readInputText(field)).toBe('before PROMPT selected after');
        expect(textBeforeCaret(field)).toBe('before PROMPT ');
      });

      it('keeps the lines of the Prompt, between the text before and the text after', async () => {
        select(7);

        const result = await strategy().insert(field, 'one\n\ntwo ');

        expect(result.success).toBe(true);
        expect(readInputText(field)).toBe('before one\n\ntwo selected after');
      });

      it('replaces the selected text', async () => {
        select(7, 15);

        const result = await strategy().insert(field, 'PROMPT');

        expect(result.success).toBe(true);
        expect(readInputText(field)).toBe('before PROMPT after');
      });

      it('goes after what the field holds when the caret is not in the field', async () => {
        const result = await strategy().insert(field, ' PROMPT');

        expect(result.success).toBe(true);
        expect(readInputText(field)).toBe('before selected after PROMPT');
      });

      it('Undo puts back the text the field held', async () => {
        const held = readInputText(field);
        select(7, 15);
        await strategy().insert(field, 'one\ntwo');

        const result = await strategy().restore(field, held);

        expect(result.success).toBe(true);
        expect(readInputText(field)).toBe(held);
      });
    });
  }
});
