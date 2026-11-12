import { vi } from 'vitest';

import { textAround } from '../../content/selector/inputText';

/**
 * Stands in for `document.execCommand` on a Platform's rich text editor (ProseMirror on ChatGPT,
 * Claude and Mistral). As the live editor does with typed text, `insertText` puts the text where
 * the selection is, in place of what is selected, and the editor then holds one paragraph per
 * line, an empty line being `<p><br></p>`, with the caret right after the inserted text. `delete`
 * removes what is selected. A command is refused when the selection is not in `editor`, and any
 * other command is refused.
 *
 * A text written straight into the DOM of such an editor is read back as one paragraph, each
 * line break turned into a space: an Insertion proves it kept the Prompt's line breaks by going
 * through this command and reading the paragraphs back.
 */
export const editorCommand = (editor: HTMLElement) =>
  vi.fn((command: string, _showUi?: boolean, value?: string): boolean => {
    const document = editor.ownerDocument;
    const selection = document.getSelection();
    if ((command !== 'insertText' && command !== 'delete') || !selection || selection.rangeCount === 0) {
      return false;
    }
    const selected = selection.getRangeAt(0);
    if (!editor.contains(selected.startContainer) || !editor.contains(selected.endContainer)) {
      return false;
    }

    // What the editor holds around the selection, as plain text
    const around = textAround(editor, selected);
    if (!around) {
      return false;
    }
    const { before, after } = around;
    const inserted = command === 'insertText' ? (value ?? '') : '';
    const text = before + inserted + after;

    // One paragraph per line, and the caret after the inserted text
    let caretAt = before.length + inserted.length;
    let caret: { node: Node; offset: number } | null = null;
    const paragraphs = text === '' ? [] : text.split('\n').map((line) => {
      const paragraph = document.createElement('p');
      const content = line === '' ? document.createElement('br') : document.createTextNode(line);
      paragraph.append(content);
      if (caret === null && caretAt <= line.length) {
        caret = line === '' ? { node: paragraph, offset: 0 } : { node: content, offset: caretAt };
      }
      caretAt -= line.length + 1;
      return paragraph;
    });
    editor.replaceChildren(...paragraphs);
    const placed = (caret ?? { node: editor, offset: 0 }) as { node: Node; offset: number };
    selection.collapse(placed.node, placed.offset);
    return true;
  });

/** A Prompt with spaces at its start, a single line break, a blank line and a line break at its end. */
export const MULTILINE_PROMPT = '  You are a reviewer.\nEnd with a verdict.\n\nDiff:\n';
