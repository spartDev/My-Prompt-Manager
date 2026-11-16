/**
 * The plain text of an input field, the `//` that opens the Prompt selector, and where an
 * Insertion goes in the field.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteTypedTriggerByEditor,
  endsWithSelectorTrigger,
  focusAtEnd,
  insertionPointOf,
  plainTextOf,
  readInputText,
  removeTypedTrigger,
  selectInsertionPoint,
  textAround,
  textBeforeCaret
} from '../inputText';

const editable = (html: string): HTMLDivElement => {
  const field = document.createElement('div');
  field.contentEditable = 'true';
  field.innerHTML = html;
  document.body.append(field);
  return field;
};

const textarea = (value: string, caret = value.length): HTMLTextAreaElement => {
  const field = document.createElement('textarea');
  document.body.append(field);
  field.value = value;
  field.setSelectionRange(caret, caret);
  return field;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('endsWithSelectorTrigger', () => {
  it.each([
    ['//', 'at the very start of the field'],
    ['Summarize this //', 'after a space'],
    ['First line\n//', 'at the start of a new line'],
    ['Tab\t//', 'after a tab'],
    ['A //', 'after a non-breaking space'],
    ['Hi /\u200B/', 'with a zero-width space an editor keeps between the slashes (Lexical, M365 Copilot)'],
    ['Hi //\uFEFF', 'with a zero-width character after the slashes']
  ])('opens on %j: %s', (before) => {
    expect(endsWithSelectorTrigger(before)).toBe(true);
  });

  it.each([
    ['https://', 'the // of a URL'],
    ['a//', 'right after a letter'],
    ['///', 'a third slash'],
    ['/', 'a single slash'],
    ['// ', 'something typed after it'],
    ['', 'an empty field'],
    ['1//', 'right after a digit'],
    ['a\u200B//', 'right after a letter, a zero-width space between'],
    ['Hi /\u200C/', 'a zero-width non-joiner between the slashes: the user wrote it (Persian, Indic scripts)'],
    ['Hi /\u200D/', 'a zero-width joiner between the slashes: the user wrote it (emoji, Indic scripts)']
  ])('does not open on %j: %s', (before) => {
    expect(endsWithSelectorTrigger(before)).toBe(false);
  });
});

describe('plainTextOf', () => {
  it('keeps the user\'s joiners as the // is read when the field itself sits in a hidden element of the page', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = '<div contenteditable="true">Hi /\u200C/</div>';
    document.body.append(wrapper);
    const field = wrapper.firstElementChild as HTMLElement;

    expect(plainTextOf(field)).toBe('Hi /\u200C/');
    wrapper.remove();
  });

  it('reads text that has no markup', () => {
    expect(plainTextOf(editable('Hello  world'))).toBe('Hello  world');
  });

  it('reads one line per paragraph', () => {
    expect(plainTextOf(editable('<p>First</p><p>Second</p>'))).toBe('First\nSecond');
  });

  it('keeps an empty paragraph as an empty line', () => {
    expect(plainTextOf(editable('<p>First</p><p><br></p><p>Third</p>'))).toBe('First\n\nThird');
  });

  it('reads an empty editor as no text: the <br> that keeps a paragraph open is not a line break', () => {
    expect(plainTextOf(editable('<p><br></p>'))).toBe('');
    expect(plainTextOf(editable('<p><br class="ProseMirror-trailingBreak"></p>'))).toBe('');
    expect(plainTextOf(editable('<br>'))).toBe('');
  });

  it('breaks the line on a <br> inside the text', () => {
    expect(plainTextOf(editable('First<br>Second'))).toBe('First\nSecond');
    expect(plainTextOf(editable('<p>First<br>Second</p>'))).toBe('First\nSecond');
  });

  it('reads rich content as plain text', () => {
    expect(plainTextOf(editable('<p>Some <strong>bold</strong> and <em>italic</em></p><ul><li>One</li><li>Two</li></ul>')))
      .toBe('Some bold and italic\nOne\nTwo');
  });

  it('starts a new line for a block that follows bare text', () => {
    expect(plainTextOf(editable('First<div>Second</div><div>Third</div>'))).toBe('First\nSecond\nThird');
  });

  it('ignores the indentation of the markup between two blocks', () => {
    expect(plainTextOf(editable('\n  <p>First</p>\n  <p>Second</p>\n'))).toBe('First\nSecond');
  });
});

describe('readInputText', () => {
  it('reads M365 Copilot\'s field after an Insertion as the Prompt, without the marks its menu left at the end', () => {
    const template = document.createElement('template');
    template.innerHTML = readFileSync(resolve(__dirname, '../../../../tests/fixtures/composers/m365copilot-after-insertion.html'), 'utf8');
    const field = template.content.getElementById('m365-chat-editor-target-element') as HTMLElement;
    document.body.append(field);

    expect(readInputText(field)).toBe('Rewrite the paragraph below so it is shorter, then say what you cut and why.\n\nParagraph:\n');
    field.remove();
  });

  it('keeps a joiner the user wrote in the editor\'s ordinary text', () => {
    const field = editable('<p><span data-lexical-text="true">a\u200Cb</span></p>');

    expect(readInputText(field)).toBe('a\u200Cb');
  });

  it('reads the value of a textarea and of an input, exactly', () => {
    expect(readInputText(textarea('  Two lines\n  kept  '))).toBe('  Two lines\n  kept  ');
    const input = document.createElement('input');
    input.value = 'A question';
    expect(readInputText(input)).toBe('A question');
  });

  it('reads the lines of a contenteditable', () => {
    expect(readInputText(editable('<p>First</p><p>Second</p>'))).toBe('First\nSecond');
  });
});

describe('textBeforeCaret', () => {
  it('reads a textarea up to its caret', () => {
    expect(textBeforeCaret(textarea('Hello world', 5))).toBe('Hello');
  });

  it('is null when text is selected in a textarea', () => {
    const field = textarea('Hello world');
    field.setSelectionRange(0, 5);
    expect(textBeforeCaret(field)).toBeNull();
  });

  it('reads a contenteditable up to its caret, with a line break between paragraphs', () => {
    const field = editable('<p>First</p><p>//rest</p>');
    const second = field.querySelectorAll('p')[1].firstChild as Text;
    document.getSelection()?.collapse(second, 2);
    expect(textBeforeCaret(field)).toBe('First\n//');
  });

  it('is null when the caret is outside the field', () => {
    const field = editable('<p>First</p>');
    const other = editable('<p>Other</p>');
    document.getSelection()?.collapse(other.querySelector('p')?.firstChild ?? null, 1);
    expect(textBeforeCaret(field)).toBeNull();
  });
});

describe('removeTypedTrigger', () => {
  it('removes the two characters before the caret of a textarea and keeps the rest', () => {
    const field = textarea('Before // after', 9);
    let heard = 0;
    field.addEventListener('input', () => { heard++; });

    expect(removeTypedTrigger(field)).toBe(true);

    expect(field.value).toBe('Before  after');
    expect(field.selectionStart).toBe(7);
    expect(heard).toBe(1);
  });

  it('leaves a textarea whose // has a character the user does not see between its slashes as it was', () => {
    const field = textarea('Hi /\u200B/', 6);

    expect(removeTypedTrigger(field)).toBe(false);
    expect(field.value).toBe('Hi /\u200B/');
  });

  it('reports a textarea whose own handler puts the // back', () => {
    const field = textarea('Before //', 9);
    field.addEventListener('input', () => { field.value = 'Before //'; });

    expect(removeTypedTrigger(field)).toBe(false);
  });

  it('reports a textarea whose own handler changes the rest of the draft', () => {
    const field = textarea('Before // after', 9);
    field.addEventListener('input', () => { field.value = field.value.toUpperCase(); });

    expect(removeTypedTrigger(field)).toBe(false);
  });

  it('takes the two characters out of a contenteditable that refuses the editing command, and tells the page', () => {
    const field = editable('<p>Before // after</p>');
    const text = field.querySelector('p')?.firstChild as Text;
    document.getSelection()?.collapse(text, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    let heard = 0;
    field.addEventListener('input', () => { heard++; });

    expect(removeTypedTrigger(field)).toBe(true);

    expect(field.textContent).toBe('Before  after');
    expect(textBeforeCaret(field)).toBe('Before ');
    expect(heard).toBe(1);
    refused.mockRestore();
  });

  describe('with the editing command of a browser', () => {
    /**
     * The browser's commands, which the test DOM lacks: `modify` extends the selection back by one
     * character of its text node, or to each of `steps` in turn (a step over an element), `delete`
     * takes the selected contents out.
     */
    const browserCommands = (steps: Array<[Node, number]> = []) => {
      const selection = document.getSelection() as Selection;
      const commandable = selection as unknown as { modify?: (alter: string, direction: string, granularity: string) => void };
      const ahead = [...steps];
      commandable.modify = () => {
        const [node, offset] = ahead.shift() ?? [selection.focusNode as Node, selection.focusOffset - 1];
        selection.extend(node, offset);
      };
      const execCommand = vi.spyOn(document, 'execCommand').mockImplementation((command: string) => {
        if (command !== 'delete') {
          return false;
        }
        selection.getRangeAt(0).deleteContents();
        return true;
      });
      return () => {
        delete commandable.modify;
        execCommand.mockRestore();
      };
    };

    it('removes a // followed by a character the user does not see, and that character with it', () => {
      const field = editable('<p>Hi //\uFEFF</p>');
      const text = field.querySelector('p')?.firstChild as Text;
      document.getSelection()?.collapse(text, text.length);
      const restore = browserCommands();

      expect(removeTypedTrigger(field)).toBe(true);

      expect(field.textContent).toBe('Hi ');
      restore();
    });

    it('removes a // with a zero-width space between its slashes', () => {
      const field = editable('<p>Hi /\u200B/ there</p>');
      const text = field.querySelector('p')?.firstChild as Text;
      document.getSelection()?.collapse(text, 6);
      const restore = browserCommands();

      expect(removeTypedTrigger(field)).toBe(true);

      expect(field.textContent).toBe('Hi  there');
      restore();
    });

    it.each([
      ['non-joiner', '\u200C'],
      ['joiner', '\u200D']
    ])('leaves alone two slashes with a zero-width %s between them', (_name, joiner) => {
      const field = editable(`<p>Hi /${joiner}/</p>`);
      const text = field.querySelector('p')?.firstChild as Text;
      document.getSelection()?.collapse(text, 6);
      const restore = browserCommands();

      expect(removeTypedTrigger(field)).toBe(false);

      expect(field.textContent).toBe(`Hi /${joiner}/`);
      restore();
    });

    describe('in M365 Copilot\'s editor while its slash menu is open', () => {
      /** The editor as read on the live page, the caret put after the spans the menu left */
      const slashMenuEditor = (held = '\u200B\u200C') => {
        const markup = readFileSync(resolve(__dirname, '../../../../tests/fixtures/composers/m365copilot-slash-menu.html'), 'utf8');
        // The fixture parsed as a page would parse it: its editor element is taken, its comment left
        const template = document.createElement('template');
        template.innerHTML = markup;
        const field = template.content.getElementById('m365-chat-editor-target-element') as HTMLElement;
        document.body.append(field);
        const [slashes, , marks] = Array.from(field.querySelectorAll('span[data-lexical-text]'), (span) => span.firstChild as Text | null);
        (marks as Text).data = held;
        document.getSelection()?.collapse(marks, (marks as Text).length);
        return { field, slashes: slashes as Text, marks: marks as Text };
      };
      afterEach(() => {
        document.getElementById('m365-chat-editor-target-element')?.remove();
      });

      it('reads the // before the caret: the marks of the hidden spans are not text of the field', () => {
        const { field } = slashMenuEditor();

        expect(textBeforeCaret(field)).toBe('//');
        expect(endsWithSelectorTrigger(textBeforeCaret(field) ?? '')).toBe(true);
      });

      it.each([
        ['the marks read on the live page', '\u200B\u200C'],
        ['two joiners', '\u200C\u200D']
      ])('removes the // with the spans the menu left after it, holding %s', (_case, held) => {
        const { field, slashes, marks } = slashMenuEditor(held);
        const restore = browserCommands([[marks, 1], [marks, 0], [slashes, 1], [slashes, 0]]);

        expect(removeTypedTrigger(field)).toBe(true);

        expect(field.querySelector('p')?.textContent).toBe('');
        restore();
      });

      it('removes the // with the caret between the marks: the mark left after it is not text of the field', () => {
        const { field, slashes, marks } = slashMenuEditor();
        document.getSelection()?.collapse(marks, 1);
        const restore = browserCommands([[marks, 0], [slashes, 1], [slashes, 0]]);

        expect(removeTypedTrigger(field)).toBe(true);

        expect(field.querySelector('p')?.textContent).toBe('\u200C');
        restore();
      });

      it('reads the marks of a hidden span as no text when the selection is within that span', () => {
        const { field, slashes, marks } = slashMenuEditor('\u200C\u200D');
        const second = marks.splitText(1);
        const span = marks.parentNode as Node;
        document.getSelection()?.collapse(second, 1);
        const restore = browserCommands([[span, 0], [slashes, 1], [slashes, 0]]);

        expect(removeTypedTrigger(field)).toBe(true);

        expect(field.querySelector('p')?.textContent).toBe('');
        restore();
      });
    });

    it('removes a // whose zero-width space is in a span of its own, as Lexical writes it', () => {
      const field = editable('<p><span>Hi /</span><span>\u200B</span><span>/</span></p>');
      const [first, space, last] = Array.from(field.querySelectorAll('span'), (span) => span.firstChild as Text);
      document.getSelection()?.collapse(last, 1);
      const restore = browserCommands([[last, 0], [space, 0], [first, 3]]);

      expect(removeTypedTrigger(field)).toBe(true);

      expect(field.textContent).toBe('Hi ');
      restore();
    });

    it('does not count a character the user does not see elsewhere in the field as a change', () => {
      const field = editable('<p>\u200BHi //</p>');
      const text = field.querySelector('p')?.firstChild as Text;
      document.getSelection()?.collapse(text, text.length);
      const restore = browserCommands();

      expect(removeTypedTrigger(field)).toBe(true);

      expect(field.textContent).toBe('\u200BHi ');
      restore();
    });

    it('removes a // that starts its own element, after another element\'s text and an icon it does not take in', () => {
      const field = editable('<p><i class="icon"><!-- drawn by the page --></i><b>Hi </b><span>//</span></p>');
      const bold = field.querySelector('b')?.firstChild as Text;
      const slashes = field.querySelector('span')?.firstChild as Text;
      document.getSelection()?.collapse(slashes, 2);
      // The selection starts at the end of the bold text, as Chrome puts it
      const restore = browserCommands([[slashes, 1], [bold, 3]]);
      const execCommand = vi.mocked(document.execCommand);

      expect(removeTypedTrigger(field)).toBe(true);

      expect(execCommand).toHaveBeenCalledWith('delete');
      expect(field.querySelector('span')?.textContent).toBe('');
      restore();
    });

    it.each([
      ['an image', '<img alt="">'],
      ['an icon chip the user cannot edit', '<span contenteditable="false"><svg></svg></span>'],
      ['an icon the page draws on an element with no text', '<span class="icon"><!-- drawn by the page --></span>'],
      ['an empty chip the user cannot edit, marked as text of Lexical', '<span contenteditable="false" data-lexical-text="true"></span>'],
      ['a hidden chip the user cannot edit that holds a joiner', '<span contenteditable="false" aria-hidden="true">\u200D</span>'],
      ['a hidden chip the user cannot edit, marked as text of Lexical, that holds a joiner', '<span contenteditable="false" aria-hidden="true" data-lexical-text="true">\u200C</span>'],
    ])('leaves a // with %s between its slashes as it was', (_what, between) => {
      const field = editable(`<p>Hi /${between}/</p>`);
      const paragraph = field.querySelector('p') as HTMLElement;
      const first = paragraph.firstChild as Text;
      const last = paragraph.lastChild as Text;
      const before = paragraph.innerHTML;
      document.getSelection()?.collapse(last, 1);
      const restore = browserCommands([[last, 0], [paragraph, 1], [first, 3]]);

      expect(textBeforeCaret(field)).toBe('Hi //');
      expect(removeTypedTrigger(field)).toBe(false);

      expect(paragraph.innerHTML).toBe(before);
      restore();
    });

    it('leaves a // with a chip the user cannot edit between its slashes, though the chip holds a zero-width space', () => {
      const field = editable('<p>Hi /<span contenteditable="false">\u200B</span>/</p>');
      const paragraph = field.querySelector('p') as HTMLElement;
      const first = paragraph.firstChild as Text;
      const last = paragraph.lastChild as Text;
      const before = paragraph.innerHTML;
      document.getSelection()?.collapse(last, 1);
      const restore = browserCommands([[last, 0], [paragraph, 1], [first, 3]]);

      expect(removeTypedTrigger(field)).toBe(false);

      expect(paragraph.innerHTML).toBe(before);
      restore();
    });
  });

  it('removes a // typed on a new line of a contenteditable, after a <br>', () => {
    const field = editable('First line<br>//');
    document.getSelection()?.collapse(field.lastChild, 2);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    expect(textBeforeCaret(field)).toBe('First line\n//');

    // The <br> is then the last thing in the field: read as the break that keeps the line open
    expect(removeTypedTrigger(field)).toBe(true);

    expect(field.textContent).toBe('First line');
    refused.mockRestore();
  });

  it('removes a // typed in a new paragraph that the editor then fills with a <br>', () => {
    const field = editable('<p>First line</p><p>//</p>');
    const second = field.querySelectorAll('p')[1];
    document.getSelection()?.collapse(second.firstChild, 2);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => {
      if (second.textContent === '') {
        second.innerHTML = '<br>';
      }
    });

    expect(removeTypedTrigger(field)).toBe(true);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor changes only the spaces of the draft on input', () => {
    const field = editable('<p>Before // after</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Beforeafter</p>'; });

    expect(removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('takes a space the browser made non-breaking, once it ends the line, as the same space', () => {
    const field = editable('<p>Before //</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before&nbsp;</p>'; });

    expect(removeTypedTrigger(field)).toBe(true);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor drops the one empty line after the // on input', () => {
    const field = editable('<p>Before //</p><p><br></p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before </p>'; });

    expect(removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor drops the empty lines at the end of the draft on input', () => {
    const field = editable('<p>Before //</p><p><br></p><p><br></p><p><br></p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before </p>'; });

    expect(removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('removes a // typed after two line breaks: one of them is then the break that keeps the line open', () => {
    const field = editable('First line<br><br>//');
    document.getSelection()?.collapse(field.lastChild, 2);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);

    expect(removeTypedTrigger(field)).toBe(true);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor puts the // back on input', () => {
    const field = editable('<p>Before //</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before //</p>'; });

    expect(removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor changes the rest of the draft on input', () => {
    const field = editable('<p>Before // after</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>BEFORE  AFTER</p>'; });

    expect(removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor drops the joiner of an emoji elsewhere in the draft on input', () => {
    const field = editable('<p>\u{1F469}\u200D\u{1F4BB} Before //</p>');
    const text = field.querySelector('p')?.firstChild as Text;
    document.getSelection()?.collapse(text, text.length);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>\u{1F469}\u{1F4BB} Before </p>'; });

    expect(removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a // it cannot remove: the caret is not in a text node that holds it', () => {
    const field = editable('<p><b>/</b>/</p>');
    const second = field.querySelector('p')?.lastChild as Text;
    document.getSelection()?.collapse(second, 1);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);

    expect(textBeforeCaret(field)).toBe('//');
    expect(removeTypedTrigger(field)).toBe(false);
    expect(field.textContent).toBe('//');
    refused.mockRestore();
  });

  it.each([
    ['between its slashes', 'Hi /\u200B/'],
    ['after its slashes', 'Hi //\uFEFF'],
  ])('without the editing command, leaves a // with an unseen character %s as it was', (_where, text) => {
    const field = editable('<p></p>');
    const node = document.createTextNode(text);
    field.querySelector('p')?.append(node);
    document.getSelection()?.collapse(node, text.length);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);

    expect(removeTypedTrigger(field)).toBe(false);
    expect(node.nodeValue).toBe(text);
    refused.mockRestore();
  });

  it('leaves the field alone when the text before the caret does not end with //', () => {
    const field = textarea('Before / after', 8);
    expect(removeTypedTrigger(field)).toBe(false);
    expect(field.value).toBe('Before / after');
  });
});

describe('deleteTypedTriggerByEditor', () => {
  /**
   * An editor that writes its own DOM, as Lexical: it cancels a deleteContentBackward and deletes the
   * character before the caret itself, drawing its paragraph anew at once. It counts the events.
   */
  const ownEditor = (field: HTMLElement, { cancels = true, deletes = true } = {}) => {
    const events: string[] = [];
    field.addEventListener('beforeinput', (event) => {
      events.push(event.inputType);
      if (!cancels) {
        return;
      }
      event.preventDefault();
      const selection = document.getSelection();
      const node = selection?.focusNode;
      if (!deletes || node?.nodeType !== Node.TEXT_NODE || event.inputType !== 'deleteContentBackward') {
        return;
      }
      const offset = selection?.focusOffset ?? 0;
      const text = (node.nodeValue ?? '').slice(0, offset - 1) + (node.nodeValue ?? '').slice(offset);
      const span = document.createElement('span');
      span.setAttribute('data-lexical-text', 'true');
      span.textContent = text;
      node.parentElement?.replaceWith(span);
      if (span.firstChild) {
        selection?.collapse(span.firstChild, offset - 1);
      } else {
        selection?.collapse(span, 0);
      }
    });
    return events;
  };
  /** M365 Copilot's editor while its slash menu is open, as read live: the caret after the // */
  const slashMenuEditor = (): HTMLElement => {
    const template = document.createElement('template');
    template.innerHTML = readFileSync(resolve(__dirname, '../../../../tests/fixtures/composers/m365copilot-slash-menu.html'), 'utf8');
    const field = template.content.getElementById('m365-chat-editor-target-element') as HTMLElement;
    document.body.append(field);
    const slashes = field.querySelector('span[data-lexical-text]')?.firstChild as Text;
    document.getSelection()?.collapse(slashes, 2);
    return field;
  };

  it('has M365 Copilot\'s editor delete the //, as two presses of Backspace, and reads it gone', async () => {
    const field = slashMenuEditor();
    const events = ownEditor(field);

    const removal = deleteTypedTriggerByEditor(field);

    expect(removal).not.toBeNull();
    await expect(removal).resolves.toBe('removed');
    expect(events).toEqual(['deleteContentBackward', 'deleteContentBackward']);
    expect(plainTextOf(field)).toBe('');
  });

  it('reads the field once an editor that draws in a microtask, as Lexical, has drawn', async () => {
    const field = slashMenuEditor();
    const slashes = field.querySelector('span[data-lexical-text]') as HTMLElement;
    let deleted = 0;
    field.addEventListener('beforeinput', (event) => {
      event.preventDefault();
      deleted += 1;
      const now = deleted;
      queueMicrotask(() => { slashes.textContent = '//'.slice(now); });
    });

    await expect(deleteTypedTriggerByEditor(field)).resolves.toBe('removed');
    expect(slashes.textContent).toBe('');
  });

  it('keeps the rest of the draft and reads it kept', async () => {
    const field = editable('<p><span data-lexical-text="true">Hi //there</span></p>');
    document.getSelection()?.collapse(field.querySelector('span')?.firstChild as Text, 5);
    ownEditor(field);

    await expect(deleteTypedTriggerByEditor(field)).resolves.toBe('removed');
    expect(field.textContent).toBe('Hi there');
  });

  it('reads the field unchanged when the editor cancels the events and deletes nothing', async () => {
    const field = slashMenuEditor();
    const events = ownEditor(field, { deletes: false });

    await expect(deleteTypedTriggerByEditor(field)).resolves.toBe('unchanged');
    expect(events).toHaveLength(2);
  });

  it('reads the field unchanged when it holds a non-breaking space the browser wrote', async () => {
    const field = editable('<p><span data-lexical-text="true">Hi \u00a0//</span></p>');
    document.getSelection()?.collapse(field.querySelector('span')?.firstChild as Text, 6);
    ownEditor(field, { deletes: false });

    await expect(deleteTypedTriggerByEditor(field)).resolves.toBe('unchanged');
  });

  it('reads the field changed when the editor deletes one slash only', async () => {
    const field = slashMenuEditor();
    const events = ownEditor(field);
    let sent = 0;
    // Its own handler runs first: the second event it cancels, and deletes nothing
    field.addEventListener('beforeinput', (event) => {
      sent += 1;
      if (sent === 2) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }, { capture: true });

    await expect(deleteTypedTriggerByEditor(field)).resolves.toBe('changed');
    expect(events).toHaveLength(1);
    expect(plainTextOf(field)).toBe('/');
  });

  it('leaves the // to removeTypedTrigger when the editor does not cancel the event, after one event', () => {
    const field = slashMenuEditor();
    const events = ownEditor(field, { cancels: false });

    expect(deleteTypedTriggerByEditor(field)).toBeNull();
    expect(events).toHaveLength(1);
    expect(plainTextOf(field)).toBe('//');
  });

  it.each([
    ['the two slashes are in two text nodes', '<p><span>Hi /</span><span>/</span></p>', 'span:last-child', 1],
    ['the caret is not right after the //', '<p><span>Hi // there</span></p>', 'span', 6],
    ['the caret is right after the // but not in a text node', '<p><span>Hi //</span></p>', 'p', 1],
  ])('sends nothing when %s', (_case, html, at, offset) => {
    const field = editable(html);
    const element = field.querySelector(at) as HTMLElement;
    document.getSelection()?.collapse(at === 'p' ? element : element.firstChild, offset);
    const events = ownEditor(field);

    expect(deleteTypedTriggerByEditor(field)).toBeNull();
    expect(events).toEqual([]);
  });

  it('sends nothing to a text control, wherever the page\'s selection is', () => {
    const field = textarea('Hi //');
    // The page's selection after a // in a text node elsewhere
    const elsewhere = editable('<p>Hi //</p>');
    document.getSelection()?.collapse(elsewhere.querySelector('p')?.firstChild as Text, 5);
    const events: Event[] = [];
    field.addEventListener('beforeinput', (event) => { events.push(event); event.preventDefault(); });

    expect(deleteTypedTriggerByEditor(field)).toBeNull();
    expect(events).toEqual([]);
  });
});

describe('focusAtEnd', () => {
  it('focuses a textarea with the caret after its last character', () => {
    const field = textarea('Hello', 0);
    focusAtEnd(field);
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(5);
    expect(field.selectionEnd).toBe(5);
  });

  it('focuses a contenteditable with a collapsed caret at its end', () => {
    const field = editable('<p>First</p><p>Second</p>');
    field.tabIndex = 0;
    focusAtEnd(field);
    const selection = document.getSelection();
    expect(selection?.isCollapsed).toBe(true);
    expect(field.contains(selection?.focusNode ?? null)).toBe(true);
    expect(textBeforeCaret(field)).toBe('First\nSecond');
  });
});

describe('textAround', () => {
  /** A range in `field`, from a point to another (the same one for a caret). */
  const rangeIn = (start: Node, startOffset: number, end = start, endOffset = startOffset): Range => {
    const range = document.createRange();
    range.setStart(start, startOffset);
    range.setEnd(end, endOffset);
    return range;
  };

  it('reads the text before and after a caret inside a line', () => {
    const field = editable('before after');

    expect(textAround(field, rangeIn(field.firstChild as Text, 7))).toEqual({ before: 'before ', after: 'after' });
  });

  it('leaves the selected text out', () => {
    const field = editable('before selected after');
    const text = field.firstChild as Text;

    expect(textAround(field, rangeIn(text, 7, text, 15))).toEqual({ before: 'before ', after: ' after' });
  });

  it('counts the line break before a caret that sits right after a <br>', () => {
    const field = editable('one<br>two');

    // Read on its own, the text up to the caret would end with a <br> that reads as no line
    expect(textAround(field, rangeIn(field, 2))).toEqual({ before: 'one\n', after: 'two' });
  });

  it('tells the end of a paragraph from the start of the next one', () => {
    const field = editable('<p>one</p><p>two</p>');
    const [first, second] = Array.from(field.querySelectorAll('p'));

    expect(textAround(field, rangeIn(first.firstChild as Text, 3))).toEqual({ before: 'one', after: '\ntwo' });
    expect(textAround(field, rangeIn(second.firstChild as Text, 0))).toEqual({ before: 'one\n', after: 'two' });
  });

  it('reads a caret on an empty line between two paragraphs', () => {
    const field = editable('<p>one</p><p><br></p><p>two</p>');
    const empty = field.querySelectorAll('p')[1];

    expect(textAround(field, rangeIn(empty, 0))).toEqual({ before: 'one\n', after: '\ntwo' });
  });

  it('reads a caret at the end of the field', () => {
    const field = editable('<p>one</p><p>two</p>');

    expect(textAround(field, rangeIn(field, 2))).toEqual({ before: 'one\ntwo', after: '' });
  });
});

describe('insertionPointOf and selectInsertionPoint', () => {
  it('give a textarea its selection back', () => {
    const field = textarea('before selected after');
    field.setSelectionRange(7, 15);
    const point = insertionPointOf(field);
    field.setSelectionRange(0, 0);

    selectInsertionPoint(field, point);

    expect([field.selectionStart, field.selectionEnd]).toEqual([7, 15]);
  });

  it('give a textarea its selection back in the direction it was made', () => {
    const field = textarea('before selected after');
    field.setSelectionRange(7, 15, 'backward');
    const point = insertionPointOf(field);
    field.setSelectionRange(0, 0);

    selectInsertionPoint(field, point);

    expect(field.selectionDirection).toBe('backward');
  });

  it('keep the selection of a textarea inside a value that got shorter meanwhile', () => {
    const field = textarea('before selected after');
    field.setSelectionRange(7, 15);
    const point = insertionPointOf(field);
    field.value = 'short';

    selectInsertionPoint(field, point);

    expect([field.selectionStart, field.selectionEnd]).toEqual([5, 5]);
  });

  it('give a contenteditable its selection back once the page\'s selection has gone elsewhere', () => {
    const field = editable('before selected after');
    const text = field.firstChild as Text;
    document.getSelection()?.setBaseAndExtent(text, 7, text, 15);
    const point = insertionPointOf(field);
    document.getSelection()?.removeAllRanges();

    selectInsertionPoint(field, point);

    expect(document.getSelection()?.toString()).toBe('selected');
  });

  it('read no point in a contenteditable the selection is not in, and then select its end', () => {
    const field = editable('draft');
    const other = editable('elsewhere');
    document.getSelection()?.collapse(other.firstChild, 3);

    const point = insertionPointOf(field);
    selectInsertionPoint(field, point);

    expect(point).toBeNull();
    expect(textBeforeCaret(field)).toBe('draft');
  });

  it('select the end of the field when the Platform has removed what the point was in', () => {
    const field = editable('<p>before after</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild as Text, 7);
    const point = insertionPointOf(field);
    const elsewhere = document.createElement('div');
    elsewhere.append(field.querySelector('p') as HTMLElement);
    field.innerHTML = '<p>rebuilt</p>';

    selectInsertionPoint(field, point);

    expect(textBeforeCaret(field)).toBe('rebuilt');
  });
});
