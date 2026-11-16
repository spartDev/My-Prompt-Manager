/**
 * The plain text of an input field, the `//` that opens the Prompt selector, and where an
 * Insertion goes in the field.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  editorSettled,
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
  it('removes the two characters before the caret of a textarea and keeps the rest', async () => {
    const field = textarea('Before // after', 9);
    let heard = 0;
    field.addEventListener('input', () => { heard++; });

    expect(await removeTypedTrigger(field)).toBe(true);

    expect(field.value).toBe('Before  after');
    expect(field.selectionStart).toBe(7);
    expect(heard).toBe(1);
  });

  it('reports a textarea whose own handler puts the // back', async () => {
    const field = textarea('Before //', 9);
    field.addEventListener('input', () => { field.value = 'Before //'; });

    expect(await removeTypedTrigger(field)).toBe(false);
  });

  it('reports a textarea whose own handler changes the rest of the draft', async () => {
    const field = textarea('Before // after', 9);
    field.addEventListener('input', () => { field.value = field.value.toUpperCase(); });

    expect(await removeTypedTrigger(field)).toBe(false);
  });

  it('takes the two characters out of a contenteditable that refuses the editing command, and tells the page', async () => {
    const field = editable('<p>Before // after</p>');
    const text = field.querySelector('p')?.firstChild as Text;
    document.getSelection()?.collapse(text, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    let heard = 0;
    field.addEventListener('input', () => { heard++; });

    expect(await removeTypedTrigger(field)).toBe(true);

    expect(field.textContent).toBe('Before  after');
    expect(textBeforeCaret(field)).toBe('Before ');
    expect(heard).toBe(1);
    refused.mockRestore();
  });

  it('removes a // typed on a new line of a contenteditable, after a <br>', async () => {
    const field = editable('First line<br>//');
    document.getSelection()?.collapse(field.lastChild, 2);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    expect(textBeforeCaret(field)).toBe('First line\n//');

    // The <br> is then the last thing in the field: read as the break that keeps the line open
    expect(await removeTypedTrigger(field)).toBe(true);

    expect(field.textContent).toBe('First line');
    refused.mockRestore();
  });

  it('removes a // typed in a new paragraph that the editor then fills with a <br>', async () => {
    const field = editable('<p>First line</p><p>//</p>');
    const second = field.querySelectorAll('p')[1];
    document.getSelection()?.collapse(second.firstChild, 2);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => {
      if (second.textContent === '') {
        second.innerHTML = '<br>';
      }
    });

    expect(await removeTypedTrigger(field)).toBe(true);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor changes only the spaces of the draft on input', async () => {
    const field = editable('<p>Before // after</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Beforeafter</p>'; });

    expect(await removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('takes a space the browser made non-breaking, once it ends the line, as the same space', async () => {
    const field = editable('<p>Before //</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before&nbsp;</p>'; });

    expect(await removeTypedTrigger(field)).toBe(true);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor drops the one empty line after the // on input', async () => {
    const field = editable('<p>Before //</p><p><br></p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before </p>'; });

    expect(await removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor drops the empty lines at the end of the draft on input', async () => {
    const field = editable('<p>Before //</p><p><br></p><p><br></p><p><br></p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before </p>'; });

    expect(await removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('removes a // typed after two line breaks: one of them is then the break that keeps the line open', async () => {
    const field = editable('First line<br><br>//');
    document.getSelection()?.collapse(field.lastChild, 2);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);

    expect(await removeTypedTrigger(field)).toBe(true);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor puts the // back on input', async () => {
    const field = editable('<p>Before //</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>Before //</p>'; });

    expect(await removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a contenteditable whose editor changes the rest of the draft on input', async () => {
    const field = editable('<p>Before // after</p>');
    document.getSelection()?.collapse(field.querySelector('p')?.firstChild ?? null, 9);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    field.addEventListener('input', () => { field.innerHTML = '<p>BEFORE  AFTER</p>'; });

    expect(await removeTypedTrigger(field)).toBe(false);
    refused.mockRestore();
  });

  it('reports a // it cannot remove: the caret is not in a text node that holds it', async () => {
    const field = editable('<p><b>/</b>/</p>');
    const second = field.querySelector('p')?.lastChild as Text;
    document.getSelection()?.collapse(second, 1);
    const refused = vi.spyOn(document, 'execCommand').mockReturnValue(false);

    expect(textBeforeCaret(field)).toBe('//');
    expect(await removeTypedTrigger(field)).toBe(false);
    expect(field.textContent).toBe('//');
    refused.mockRestore();
  });

  it('leaves the field alone when the text before the caret does not end with //', async () => {
    const field = textarea('Before / after', 8);
    expect(await removeTypedTrigger(field)).toBe(false);
    expect(field.value).toBe('Before / after');
  });

  it.each([
    ['a ProseMirror, Quill or other editor', () => editable('<p>Draft //</p>')],
    ['a textarea', () => textarea('Draft //')]
  ])('sends no beforeinput to %s: only a Lexical editor is asked to delete the // itself', async (_name, make) => {
    const field = make();
    const text = field.querySelector('p')?.firstChild;
    if (text) {
      document.getSelection()?.collapse(text, 8);
    }
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    let heard = 0;
    field.addEventListener('beforeinput', () => { heard++; });

    expect(await removeTypedTrigger(field)).toBe(true);
    expect(readInputText(field)).toBe('Draft ');
    expect(heard).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('the // typed in a Lexical composer (Perplexity)', () => {
  const PERPLEXITY = resolve(__dirname, '../../../../tests/fixtures/composers/perplexity.html');

  /**
   * What the editor does with a `beforeinput` that asks it to delete backward: Lexical takes the
   * selection out of its state and cancels the event; an editor may also leave the event alone, or
   * take the text out without cancelling the event.
   */
  type BeforeInput = 'cancels' | 'ignores' | 'deletes without cancelling';

  /**
   * Perplexity's composer, as its fixture holds it empty (<p><br></p>), with what Chrome and
   * Lexical do around it, enough for the //:
   * - Lexical marks the element it edits with data-lexical-editor (the sanitized fixture keeps
   *   only what the Platform's selectors read) and renders the text of a paragraph in a
   *   <span data-lexical-text="true">;
   * - a `beforeinput` that deletes backward, Lexical cancels, takes the selected text out of its
   *   state at once, and draws the field again in a microtask;
   * - Chrome's `delete` command removes the span it empties, and keeps the paragraph open with a
   *   <br>;
   * - Lexical takes a text of its own that changed, but puts back an element of its own that was
   *   removed: it renders the paragraph again from its state;
   * - a text it finds emptied, Lexical 0.38 to 0.45 (0.41 on perplexity.ai) keeps in its state as
   *   it was and takes out of the field 20 ms later, with whatever was typed in it meanwhile, in
   *   an update of its own whose commit puts its selection back in the paragraph with
   *   setBaseAndExtent: in Chrome, that takes the focus back to the field.
   */
  const lexicalComposer = (beforeInput: BeforeInput = 'cancels') => {
    document.body.innerHTML = readFileSync(PERPLEXITY, 'utf8');
    const field = document.querySelector<HTMLElement>('[contenteditable="true"][role="textbox"]');
    if (!field) {
      throw new Error('No editor in the Perplexity composer fixture');
    }
    expect(field.innerHTML).toBe('<p><br></p>');
    field.setAttribute('data-lexical-editor', 'true');
    const selection = document.getSelection() as Selection;
    let state = '';
    let rendered: HTMLElement | null = null;
    // The text found emptied, while it waits for the editor's update that takes it out
    let emptied: Text | null = null;
    const render = (): void => {
      // A field a test left behind is not drawn again: its selection would be the next test's
      if (!field.isConnected) {
        return;
      }
      const paragraph = document.createElement('p');
      if (state === '') {
        paragraph.append(document.createElement('br'));
        rendered = null;
      } else {
        paragraph.dir = 'ltr';
        const span = document.createElement('span');
        span.setAttribute('data-lexical-text', 'true');
        span.textContent = state;
        paragraph.append(span);
        rendered = span;
      }
      field.replaceChildren(paragraph);
      const text = rendered?.firstChild;
      if (text) {
        selection.collapse(text, state.length);
      } else {
        selection.setBaseAndExtent(paragraph, 0, paragraph, 0);
      }
    };
    field.addEventListener('beforeinput', (event) => {
      const text = rendered?.firstChild;
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (beforeInput === 'ignores' || event.inputType !== 'deleteContentBackward' || !text || !range
        || range.startContainer !== text || range.endContainer !== text) {
        return;
      }
      if (beforeInput === 'cancels') {
        event.preventDefault();
        state = state.slice(0, range.startOffset) + state.slice(range.endOffset);
        queueMicrotask(render);
      } else {
        range.deleteContents();
        state = text.textContent ?? '';
      }
    });
    field.addEventListener('input', () => {
      if (rendered?.isConnected) {
        if (rendered.textContent === '') {
          emptied = rendered.firstChild as Text;
          window.setTimeout(() => {
            emptied = null;
            state = '';
            render();
          }, 20);
        } else {
          state = rendered.textContent ?? '';
        }
      } else {
        render();
      }
    });

    Object.defineProperty(Selection.prototype, 'modify', {
      configurable: true,
      value(this: Selection, alter: string, direction: string, granularity: string) {
        if (alter === 'extend' && direction === 'backward' && granularity === 'character' && this.focusNode) {
          this.extend(this.focusNode, this.focusOffset - 1);
        }
      }
    });
    const execCommand = vi.spyOn(document, 'execCommand').mockImplementation((command) => {
      if (command !== 'delete' || selection.rangeCount === 0) {
        return false;
      }
      const range = selection.getRangeAt(0);
      const inline = range.startContainer.parentElement;
      range.deleteContents();
      if (inline?.tagName === 'SPAN' && inline.textContent === '') {
        const paragraph = inline.parentElement as HTMLElement;
        inline.remove();
        if (paragraph.childNodes.length === 0) {
          paragraph.append(document.createElement('br'));
        }
        selection.collapse(paragraph, 0);
      }
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      return true;
    });

    /** A key typed in the field: in a text found emptied, it goes in that text, and with it. */
    const type = (typed: string): void => {
      if (emptied) {
        emptied.appendData(typed);
        selection.collapse(emptied, emptied.length);
        return;
      }
      state += typed;
      render();
    };
    return { field, type, execCommand };
  };

  /** Whether the promise has settled once the microtasks queued so far have run. */
  const settledNow = async (promise: Promise<void>): Promise<boolean> => {
    let settled = false;
    void promise.then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    return settled;
  };

  // The editor's 20 ms update runs on the test's clock: it never outlives the test it belongs to
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (Selection.prototype as { modify?: unknown }).modify;
  });

  it('opens on a // typed in the empty field, and both characters are gone', async () => {
    const { field, type } = lexicalComposer();
    type('/');
    type('/');

    expect(endsWithSelectorTrigger(textBeforeCaret(field) ?? '')).toBe(true);
    expect(await removeTypedTrigger(field)).toBe(true);
    expect(readInputText(field)).toBe('');
  });

  it('opens on a // typed after a space in a draft, and the draft stays', async () => {
    const { field, type } = lexicalComposer();
    type('a //');

    expect(endsWithSelectorTrigger(textBeforeCaret(field) ?? '')).toBe(true);
    expect(await removeTypedTrigger(field)).toBe(true);
    expect(readInputText(field)).toBe('a ');
  });

  it('opens nothing on the // of https://', () => {
    const { field, type } = lexicalComposer();
    type('https://');

    expect(endsWithSelectorTrigger(textBeforeCaret(field) ?? '')).toBe(false);
  });

  it('keeps a key typed right after the // is gone (//t typed in one go)', async () => {
    const { field, type } = lexicalComposer();
    type('//');
    expect(await removeTypedTrigger(field)).toBe(true);

    type('t');
    await vi.advanceTimersByTimeAsync(20);

    expect(readInputText(field)).toBe('t');
  });

  it('lets the editor take the // out itself: no emptied text is left to wait for', async () => {
    const { field, type, execCommand } = lexicalComposer();
    type('//');
    expect(await removeTypedTrigger(field)).toBe(true);

    expect(execCommand).not.toHaveBeenCalled();
    expect(field.querySelector('span')).toBeNull();
    expect(await settledNow(editorSettled(field))).toBe(true);
    expect(document.getSelection()?.focusNode).toBe(field.querySelector('p'));
  });

  it('removes the // once from an editor that takes it out without cancelling the event', async () => {
    const { field, type, execCommand } = lexicalComposer('deletes without cancelling');
    type('a //');

    expect(await removeTypedTrigger(field)).toBe(true);
    expect(readInputText(field)).toBe('a ');
    expect(execCommand).not.toHaveBeenCalled();
  });

  describe('when the editor leaves the beforeinput alone', () => {
    it('takes the // out of its text node', async () => {
      const { field, type } = lexicalComposer('ignores');
      type('//');

      expect(await removeTypedTrigger(field)).toBe(true);
      expect(readInputText(field)).toBe('');
    });

    it('is settled once the editor has taken the emptied text out, not before', async () => {
      const { field, type } = lexicalComposer('ignores');
      type('//');
      expect(await removeTypedTrigger(field)).toBe(true);

      let settled = false;
      void editorSettled(field).then(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(19);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      // The selection the editor put back is the one the selector reads as the insertion point
      expect(document.getSelection()?.focusNode).toBe(field.querySelector('p'));
    });

    it('removes a // from a draft with the editing command, settled at once', async () => {
      const { field, type, execCommand } = lexicalComposer('ignores');
      type('a //');
      expect(await removeTypedTrigger(field)).toBe(true);

      expect(execCommand).toHaveBeenCalledWith('delete');
      expect(readInputText(field)).toBe('a ');
      expect(await settledNow(editorSettled(field))).toBe(true);
    });
  });
});

describe('editorSettled', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Whether the promise has settled once the microtasks queued so far have run. */
  const settledNow = async (promise: Promise<void>): Promise<boolean> => {
    let settled = false;
    void promise.then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    return settled;
  };

  it('is settled at once for a textarea', async () => {
    expect(await settledNow(editorSettled(textarea('Draft ')))).toBe(true);
  });

  it('is settled at once when the caret is in text', async () => {
    const field = editable('<p><span>Draft </span></p>');
    const text = field.querySelector('span')?.firstChild as Text;
    document.getSelection()?.collapse(text, 6);

    expect(await settledNow(editorSettled(field))).toBe(true);
  });

  it('waits for an emptied text of an inline element to leave the field', async () => {
    const field = editable('<p><span></span></p>');
    const span = field.querySelector('span') as HTMLElement;
    const emptied = document.createTextNode('');
    span.append(emptied);
    document.getSelection()?.collapse(emptied, 0);

    const settled = editorSettled(field);
    expect(await settledNow(settled)).toBe(false);

    span.remove();

    expect(await settledNow(settled)).toBe(true);
  });

  it('stops waiting after 100 ms for an editor that leaves the emptied text where it is', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const field = editable('<p><span></span></p>');
    const emptied = document.createTextNode('');
    field.querySelector('span')?.append(emptied);
    document.getSelection()?.collapse(emptied, 0);

    let settled = false;
    void editorSettled(field).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(99);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
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
