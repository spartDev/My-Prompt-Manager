/**
 * Makes `editor` behave as Perplexity's Lexical composer does with what an Insertion can send it
 * (seen on the live site on 2026-11-11):
 *
 * - a paste replaces what is selected, the whole field here, by the pasted lines: one <span> per
 *   line that has text, one <br> between two lines, and a last <br> that keeps an empty last line
 *   open; the paste event is cancelled;
 * - an `input` event that carries text inserts that text again, at the end: the double write;
 * - a Backspace key removes the last character;
 * - the editing command inserts text with its line breaks dropped.
 *
 * Returns the stand-in for `document.execCommand`.
 */
export function actAsLexicalEditor(editor: HTMLElement): (command: string, showUi?: boolean, value?: string) => boolean {
  const document = editor.ownerDocument;

  const layOut = (text: string): void => {
    const paragraph = document.createElement('p');
    if (text === '') {
      paragraph.append(document.createElement('br'));
    } else {
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (line !== '') {
          const span = document.createElement('span');
          span.textContent = line;
          paragraph.append(span);
        }
        if (index < lines.length - 1) {
          paragraph.append(document.createElement('br'));
        }
      });
      if (lines.length > 1 && lines[lines.length - 1] === '') {
        paragraph.append(document.createElement('br'));
      }
    }
    editor.replaceChildren(paragraph);
  };

  const held = (): string => {
    const lines: string[] = [''];
    const nodes = Array.from(editor.querySelector('p')?.childNodes ?? []);
    nodes.forEach((node, index) => {
      if (node.nodeName === 'BR') {
        if (index < nodes.length - 1) {
          lines.push('');
        }
      } else {
        lines[lines.length - 1] += node.textContent ?? '';
      }
    });
    return lines.join('\n');
  };

  layOut('');

  editor.addEventListener('paste', (event) => {
    event.preventDefault();
    layOut((event as ClipboardEvent).clipboardData?.getData('text/plain') ?? '');
  });

  editor.addEventListener('input', (event) => {
    const data = (event as InputEvent).data;
    if (typeof data === 'string' && data !== '') {
      layOut(held() + data);
    }
  });

  editor.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Backspace') {
      event.preventDefault();
      layOut(held().slice(0, -1));
    }
  });

  return (command, _showUi, value) => {
    if (command === 'insertText') {
      layOut((value ?? '').replace(/\n/g, ''));
      return true;
    }
    // 'delete' is taken and changes nothing
    return command === 'delete';
  };
}
