/**
 * Perplexity Platform Strategy module
 *
 * Perplexity's composer is a Lexical editor. Text reaches it as a paste: where the caret is for
 * an Insertion, over everything it holds for Undo. Lexical then lays the lines out itself, one
 * <br> between two. What was tried on the live site and is not used there (2026-11-11):
 * - execCommand('insertText') drops every line break;
 * - an `input` event carrying the text makes Lexical insert it a second time;
 * - execCommand('selectAll') and a range over the editor leave out the line breaks that end the
 *   field, which then pile up under the next text;
 * - execCommand('delete') changes nothing, and froze the page on a field of several lines.
 */

import { getPlatformById } from '../../config/platforms';
import { readInputText, textAround } from '../selector/inputText';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

/** How long the editor is given to hear of a new selection, or to lay out pasted text. */
const EDITOR_SETTLE_MS = 100;

/** The one character pasted over a field to empty it, before a Backspace removes it. */
const ERASED_CHARACTER = ' ';

export class PerplexityStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('perplexity', 80, {
      selectors: [
        'div[contenteditable="true"][role="textbox"]#ask-input'
      ],
      priority: 80
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element
   * Handles any element on www.perplexity.ai
   */
  canHandle(_element: HTMLElement): boolean {
    return this.hostname === getPlatformById('perplexity')?.hostname;
  }

  /**
   * Puts `content` in the composer where its caret is, once: as a paste into the editor, or
   * through the editing command when nothing on the page takes the paste.
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      return await this._insertText(element, content, 'perplexity');
    } catch (error) {
      this._error('Perplexity insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Undo: puts the draft back the way an Insertion goes in, so its line breaks come back too.
   */
  async restore(element: HTMLElement, text: string): Promise<InsertionResult> {
    try {
      if (PerplexityStrategy._isEditable(element)) {
        if (readInputText(element) === text) {
          return { success: true, method: 'restore-unchanged' };
        }
        return await this._replaceText(element, text, 'restore');
      }
    } catch (error) {
      this._error('Restoring the input field failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
    return super.restore(element, text);
  }

  private static _isEditable(element: HTMLElement): boolean {
    return element.isContentEditable || element.getAttribute('contenteditable') === 'true';
  }

  /**
   * An Insertion: `text` goes where the caret is, in place of what is selected, and the text
   * before and after stays. A field with no caret in it takes the text at its end.
   */
  private async _insertText(element: HTMLElement, text: string, via: string): Promise<InsertionResult> {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      // A page whose own handler rewrote the value did not take the text
      return this.insertIntoTextControl(element, text)
        ? { success: true, method: `${via}-value` }
        : { success: false, error: 'The input field did not keep the text' };
    }

    if (!PerplexityStrategy._isEditable(element)) {
      return { success: false, error: 'The input field holds no editable text' };
    }

    // A paste of nothing is no paste, and nothing is what there is to insert
    if (text === '') {
      return this.insertEditableText(element, text, via);
    }

    let around: { before: string; after: string } | null = null;
    const taken = await this._paste(element, text, (selection) => {
      const range = PerplexityStrategy._caretRange(element, selection);
      around = textAround(element, range);
    }, () => (around ? around.before + text + around.after : null));
    if (!taken) {
      // Nothing on the page took the paste: this is no rich text editor
      return this.insertEditableText(element, text, via);
    }

    // The editor took the paste. Writing the text again by another path is what put the Prompt in
    // twice, so a field that reads differently is a failure, not a reason to write once more.
    // When what the field held around the caret could not be read, the paste is trusted
    const expected = (around as { before: string; after: string } | null);
    if (expected === null || PerplexityStrategy._sameText(readInputText(element), expected.before + text + expected.after)) {
      this._debug('Paste insertion successful');
      return { success: true, method: `${via}-paste` };
    }
    return { success: false, error: 'The input field did not keep the text' };
  }

  /**
   * The caret or the selection of the editor, where an Insertion goes. An editor the selection
   * is not in takes the caret at the end of its last block, where the editor itself has a caret.
   */
  private static _caretRange(element: HTMLElement, selection: Selection): Range {
    if (selection.rangeCount > 0) {
      const current = selection.getRangeAt(0);
      if (element.contains(current.startContainer) && element.contains(current.endContainer)) {
        return current;
      }
    }
    const last = element.lastElementChild ?? element;
    const atEnd = element.ownerDocument.createRange();
    atEnd.setStart(last, last.childNodes.length);
    atEnd.collapse(true);
    selection.removeAllRanges();
    selection.addRange(atEnd);
    return atEnd;
  }

  /** Undo: `text` becomes the whole text of the composer. */
  private async _replaceText(element: HTMLElement, text: string, via: string): Promise<InsertionResult> {
    if (!PerplexityStrategy._isEditable(element)) {
      return { success: false, error: 'The input field holds no editable text' };
    }

    // A paste of nothing is no paste: to empty the field, one character goes over everything,
    // then a Backspace takes it away
    const emptying = text === '';
    const pasted = emptying ? ERASED_CHARACTER : text;
    if (!(await this._paste(element, pasted, (selection) => { PerplexityStrategy._selectAll(element, selection); }, () => pasted))) {
      // Nothing on the page took the paste: this is no rich text editor
      return this.replaceEditableText(element, text, via);
    }
    if (emptying) {
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true
      }));
      await this._settled(element, text);
    }

    // The editor took the paste. Writing the text again by another path is what put the Prompt in
    // twice, so a field that reads differently is a failure, not a reason to write once more
    if (PerplexityStrategy._sameText(readInputText(element), text)) {
      this._debug('Paste insertion successful');
      return { success: true, method: `${via}-paste` };
    }
    return { success: false, error: 'The input field did not keep the text' };
  }

  /**
   * Selects everything the editor holds: from the start of the first block to the end of the last
   * one, so the selection takes the line breaks that end the field.
   */
  private static _selectAll(element: HTMLElement, selection: Selection): void {
    const first = element.firstElementChild ?? element;
    const last = element.lastElementChild ?? element;
    const range = element.ownerDocument.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Pastes `text` in the editor where `select` puts the selection. Returns whether the page took
   * the paste: an editor that handles a paste cancels the event.
   *
   * The editor learns of a selection from the `selectionchange` event, which comes after the
   * selection is set: a paste sent before it lands at the editor's old caret. `expected` is the
   * text the editor must hold once it has laid the paste out, or null when it cannot be told.
   */
  private async _paste(
    element: HTMLElement,
    text: string,
    select: (selection: Selection) => void,
    expected: () => string | null
  ): Promise<boolean> {
    const document = element.ownerDocument;
    const selection = document.getSelection();
    if (!selection || typeof DataTransfer !== 'function' || typeof ClipboardEvent !== 'function') {
      return false;
    }

    element.focus();
    const selectionHeard = new Promise<void>((resolve) => {
      const done = (): void => {
        document.removeEventListener('selectionchange', done);
        resolve();
      };
      document.addEventListener('selectionchange', done);
      setTimeout(done, EDITOR_SETTLE_MS);
    });
    select(selection);
    await selectionHeard;

    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    const taken = !element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    const settledText = expected();
    if (taken && settledText !== null) {
      await this._settled(element, settledText);
    }
    return taken;
  }

  /** Waits until the editor holds `text`, or has had the time to lay it out. */
  private _settled(element: HTMLElement, text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const holdsText = (): boolean => PerplexityStrategy._sameText(readInputText(element), text);
      if (holdsText()) {
        resolve();
        return;
      }
      const finish = (): void => {
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      };
      const observer = new MutationObserver(() => {
        if (holdsText()) {
          finish();
        }
      });
      const timer = setTimeout(finish, EDITOR_SETTLE_MS);
      observer.observe(element, { childList: true, subtree: true, characterData: true });
    });
  }

  /**
   * Whether the editor holds `text`. An editor may show a space of the text as a non-breaking
   * space, and that is no difference. The other way round is one: a non-breaking space of the
   * text must still be a non-breaking space in the field, or the Prompt is not Verbatim.
   */
  private static _sameText(held: string, text: string): boolean {
    if (held.length !== text.length) {
      return false;
    }
    for (let index = 0; index < text.length; index++) {
      const wanted = text[index];
      const found = held[index];
      if (found !== wanted && !(wanted === ' ' && found === '\u00a0')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Gets selectors for finding Perplexity input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Perplexity-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createPerplexityIcon();
  }
}
