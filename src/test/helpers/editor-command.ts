import { vi } from 'vitest';

/**
 * Stands in for `document.execCommand` on a Platform's rich text editor (ProseMirror on ChatGPT,
 * Claude and Mistral): the content of `editor` is replaced by one paragraph per line, an empty
 * line being `<p><br></p>`, as the live editor builds them from typed text. Any other command is
 * refused.
 *
 * A text written straight into the DOM of such an editor is read back as one paragraph, each
 * line break turned into a space: an Insertion proves it kept the Prompt's line breaks by going
 * through this command and reading the paragraphs back.
 */
export const editorCommand = (editor: HTMLElement) =>
  vi.fn((command: string, _showUi?: boolean, value?: string): boolean => {
    if (command === 'delete') {
      editor.replaceChildren();
      return true;
    }
    if (command !== 'insertText') {
      return false;
    }
    editor.replaceChildren(
      ...(value ?? '').split('\n').map((line) => {
        const paragraph = editor.ownerDocument.createElement('p');
        paragraph.append(line === '' ? editor.ownerDocument.createElement('br') : line);
        return paragraph;
      })
    );
    return true;
  });

/** A Prompt with spaces at its start, a single line break, a blank line and a line break at its end. */
export const MULTILINE_PROMPT = '  You are a reviewer.\nEnd with a verdict.\n\nDiff:\n';
