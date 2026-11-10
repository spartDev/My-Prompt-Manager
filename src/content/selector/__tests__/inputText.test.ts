/**
 * The plain text of an input field and the `//` that opens the Prompt selector.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { endsWithSelectorTrigger, focusAtEnd, plainTextOf, readInputText, removeTypedTrigger, textBeforeCaret } from '../inputText';

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
    ['A //', 'after a non-breaking space']
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
    ['1//', 'right after a digit']
  ])('does not open on %j: %s', (before) => {
    expect(endsWithSelectorTrigger(before)).toBe(false);
  });
});

describe('plainTextOf', () => {
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

  it('leaves the field alone when the text before the caret does not end with //', () => {
    const field = textarea('Before / after', 8);
    expect(removeTypedTrigger(field)).toBe(false);
    expect(field.value).toBe('Before / after');
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
