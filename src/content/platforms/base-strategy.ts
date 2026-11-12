/**
 * Base Platform Strategy module
 * 
 * Abstract base class that defines the contract for platform-specific insertion strategies.
 * Each platform must implement all abstract methods to ensure consistent behavior.
 */

import { readInputText, textAround } from '../selector/inputText';
import type { InsertionResult, PlatformConfig, PlatformStrategyInterface } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { debug, error as logError, warn  } from '../utils/logger';

export abstract class PlatformStrategy implements PlatformStrategyInterface {
  public readonly name: string;
  public readonly priority: number;
  protected config?: PlatformConfig;
  protected hostname: string;

  constructor(name: string, priority: number, config?: PlatformConfig, hostname?: string) {
    if (this.constructor === PlatformStrategy) {
      throw new Error('PlatformStrategy is abstract and cannot be instantiated');
    }

    this.name = name;
    this.priority = priority;
    this.config = config;
    this.hostname = hostname ?? window.location.hostname;

    // Validate required methods are implemented
    this._validateImplementation();
  }

  /**
   * Validates that all abstract methods are implemented by concrete classes
   * @private
   */
  private _validateImplementation(): void {
    const requiredMethods = ['canHandle', 'insert', 'getSelectors'];
    for (const method of requiredMethods) {
      if (typeof (this as Record<string, unknown>)[method] !== 'function') {
        throw new Error(`Strategy ${this.name} must implement ${method}() method`);
      }
    }
  }

  /**
   * Determines if this strategy can handle the given element
   * @param element - The target element
   * @returns True if this strategy can handle the element
   * @abstract
   */
  abstract canHandle(element: HTMLElement): boolean;

  /**
   * Inserts content into the target element using platform-specific logic
   * @param element - The target element
   * @param content - The content to insert
   * @returns Result of the insertion attempt
   * @abstract
   */
  abstract insert(element: HTMLElement, content: string): Promise<InsertionResult>;

  /**
   * Gets the CSS selectors used to find input elements for this platform
   * @returns Array of CSS selectors
   * @abstract
   */
  abstract getSelectors(): string[];

  /**
   * Puts `text` back as the whole content of the input field: what Undo does after an Insertion.
   * It replaces everything the field holds, whatever path the Insertion took (a strategy whose
   * first path inserts at the caret still restores the whole field here), and tells the Platform
   * through the events typing would send. Rich content comes back as plain text.
   * @param element - The input field
   * @param text - The plain text the field held before the Insertion
   * @returns Result of the attempt
   */
  restore(element: HTMLElement, text: string): Promise<InsertionResult> {
    try {
      element.focus();

      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        // The native accessors, so a framework that tracks the value on the element (React) sees
        // the change, and so what is read back is what the field really holds
        const native = Object.getOwnPropertyDescriptor(prototype, 'value') as
          | { get?: (this: HTMLElement) => string; set?: (this: HTMLElement, value: string) => void }
          | undefined;
        if (native?.set) {
          native.set.call(element, text);
        } else {
          element.value = text;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        // A page whose own handler rewrote the value did not take the text back
        if ((native?.get ? native.get.call(element) : element.value) !== text) {
          return Promise.resolve({ success: false, error: 'The input field did not keep the restored text' });
        }
        return Promise.resolve({ success: true, method: 'restore-value' });
      }

      if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
        if (readInputText(element) === text) {
          return Promise.resolve({ success: true, method: 'restore-unchanged' });
        }
        return Promise.resolve(this.replaceEditableText(element, text, 'restore'));
      }

      return Promise.resolve({ success: false, error: 'The input field holds no editable text' });
    } catch (error) {
      this._error('Restoring the input field failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Puts `text` in a <textarea> or an <input> where its caret is, in place of the text selected
   * there: what an Insertion does. The text before and after stays, and the caret ends right
   * after `text`. A field that has no caret (an <input> of a type without a text selection)
   * takes the text at its end. The value goes through the native setter, so a framework that
   * tracks it on the element (React) sees the change, and the page is told as typing would.
   * @param element - The input field
   * @param text - The text to insert, exactly as given
   * @returns Whether the field holds the text afterwards: a page whose own handler rewrote the value did not take it
   * @protected
   */
  protected insertIntoTextControl(element: HTMLTextAreaElement | HTMLInputElement, text: string): boolean {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const native = Object.getOwnPropertyDescriptor(prototype, 'value') as
      | { get?: (this: HTMLElement) => string; set?: (this: HTMLElement, value: string) => void }
      | undefined;
    const held = element.value;
    let start = held.length;
    let end = held.length;
    try {
      start = element.selectionStart ?? held.length;
      end = element.selectionEnd ?? start;
    } catch {
      // An <input> of a type without a text selection: the text goes at the end
    }
    const expected = held.slice(0, start) + text + held.slice(end);

    element.focus();
    if (native?.set) {
      native.set.call(element, expected);
    } else {
      element.value = expected;
    }
    try {
      element.setSelectionRange(start + text.length, start + text.length);
    } catch {
      // No text selection on this type of <input>
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return (native?.get ? native.get.call(element) : element.value) === expected;
  }

  /**
   * The caret or the selection of a contenteditable input field, where an Insertion goes. A field
   * the selection is not in takes the caret at its end, so the text goes after what it holds.
   * @param element - The contenteditable input field
   * @returns The range, which is the document's selection when there is one
   * @protected
   */
  protected insertionRange(element: HTMLElement): Range {
    const document = element.ownerDocument;
    const selection = document.getSelection();
    if (selection && selection.rangeCount > 0) {
      const current = selection.getRangeAt(0);
      if (element.contains(current.startContainer) && element.contains(current.endContainer)) {
        return current;
      }
    }
    const atEnd = document.createRange();
    atEnd.selectNodeContents(element);
    atEnd.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(atEnd);
    return atEnd;
  }

  /**
   * Puts `text` in a contenteditable input field where its caret is, in place of what is selected
   * there: what an Insertion does. The text before and after stays, and the caret ends right
   * after `text`. A field with no caret in it takes the text at its end.
   *
   * The text goes in through the browser's editing command, as typing would, so the Platform's
   * editor (ProseMirror, Quill, Lexical) builds its own paragraphs from the line breaks. When
   * there is no editing command, or the field does not read as expected afterwards, the whole
   * text of the field is written directly, one <br> between two lines.
   * @param element - The contenteditable input field
   * @param text - The text to insert, exactly as given
   * @param via - Prefix of the method named in the result ('default', 'chatgpt'...)
   * @returns Result of the attempt
   * @protected
   */
  protected insertEditableText(element: HTMLElement, text: string, via: string): InsertionResult {
    const document = element.ownerDocument;
    element.focus();
    const range = this.insertionRange(element);
    const around = textAround(element, range);
    if (text === '' && range.collapsed) {
      return { success: true, method: `${via}-unchanged` };
    }
    const edited = typeof document.execCommand === 'function'
      && (text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text));
    if (!around) {
      // What the field held around the caret could not be read: the editing command is trusted,
      // and nothing is written over text that cannot be checked
      return edited
        ? { success: true, method: `${via}-execCommand` }
        : { success: false, error: 'The input field did not take the text' };
    }
    const { before, after } = around;
    if (edited && PlatformStrategy.holdsInsertion(readInputText(element), before, text, after)) {
      return { success: true, method: `${via}-execCommand` };
    }
    // No editing command, or the editor laid the text out differently: write the whole text
    // directly, the text around the caret included
    return this.writeEditableText(element, before + text + after, before.length + text.length, text, via);
  }

  /**
   * Whether `held` is `before`, `text` and `after` in a row. `text` must be there character for
   * character (Verbatim). Around it, a space and a non-breaking space are the same: the browser
   * turns one into the other at the edges of what is typed, as it does while the user types.
   */
  private static holdsInsertion(held: string, before: string, text: string, after: string): boolean {
    const spaces = (value: string): string => value.replace(/\u00a0/g, ' ');
    return held.length === before.length + text.length + after.length
      && spaces(held.slice(0, before.length)) === spaces(before)
      && held.slice(before.length, before.length + text.length) === text
      && spaces(held.slice(before.length + text.length)) === spaces(after);
  }

  /**
   * Writes `text` straight into a contenteditable input field as its whole content, one <br>
   * between two lines so the breaks show whatever the field does with spaces, puts the caret
   * after its first `caret` characters, and tells the page as typing `inserted` would, or, with
   * no `inserted` text, that its content was replaced.
   * @returns Failure when an editor whose own handler rebuilt its content did not keep the text
   */
  private writeEditableText(element: HTMLElement, text: string, caret: number, inserted: string | null, via: string): InsertionResult {
    const document = element.ownerDocument;
    const lines = text.split('\n');
    const content = document.createDocumentFragment();
    let remaining = caret;
    // Where the caret goes: in a text node, or before the child of the field at an index
    let caretIn: { node: Node; offset: number } | null = null;
    let caretBefore: number | null = null;
    lines.forEach((line, index) => {
      if (caretIn === null && caretBefore === null && remaining <= line.length) {
        // The line is cut where the caret goes: the caret sits at the end of its first part,
        // or before the line when it has no first part
        const head = line.slice(0, remaining);
        if (head === '') {
          caretBefore = content.childNodes.length;
        } else {
          const node = document.createTextNode(head);
          content.append(node);
          caretIn = { node, offset: head.length };
        }
        if (line.length > remaining) {
          content.append(line.slice(remaining));
        }
      } else if (line !== '') {
        content.append(line);
      }
      remaining -= line.length + 1;
      if (index < lines.length - 1) {
        content.append(document.createElement('br'));
      }
    });
    // A last line that is empty takes a second <br>, the one that keeps it open
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      content.append(document.createElement('br'));
    }
    element.replaceChildren(content);
    const selection = document.getSelection();
    const placed = caretIn as { node: Node; offset: number } | null;
    if (placed) {
      selection?.collapse(placed.node, placed.offset);
    } else {
      selection?.collapse(element, caretBefore ?? element.childNodes.length);
    }
    // The event carries what was inserted, not the text around it: an editor that takes the
    // data of an input event as new text would put the draft in a second time
    // A field whose whole content was replaced (Undo) is told so, with no text to insert at all
    element.dispatchEvent(inserted === null
      ? new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: null })
      : new InputEvent('input', { bubbles: true, inputType: 'insertText', data: inserted }));
    // An editor whose own handler rebuilt its content did not take the text
    if (readInputText(element) !== text) {
      return { success: false, error: 'The input field did not keep the text' };
    }
    return { success: true, method: `${via}-dom` };
  }

  /**
   * Makes `text` the whole content of a contenteditable input field, line breaks included: what
   * an Insertion and Undo both do there.
   *
   * The text goes in through the browser's editing command, as typing would, so the Platform's
   * editor (ProseMirror, Quill, Lexical) builds its own paragraphs from the line breaks. Text
   * written straight into the DOM is read back by such an editor as one paragraph, each line
   * break turned into a space. When there is no editing command, or the field does not hold
   * `text` afterwards, the text is written directly, one <br> between two lines.
   * @param element - The contenteditable input field
   * @param text - The plain text the field must hold
   * @param via - Prefix of the method named in the result ('restore', 'default'...)
   * @returns Result of the attempt
   * @protected
   */
  protected replaceEditableText(element: HTMLElement, text: string, via: string): InsertionResult {
    const document = element.ownerDocument;
    element.focus();
    const selection = document.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const edited = typeof document.execCommand === 'function'
      && (text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text));
    if (edited && readInputText(element) === text) {
      return { success: true, method: `${via}-execCommand` };
    }
    // No editing command, or the editor laid the text out differently: write it directly
    return this.writeEditableText(element, text, text.length, null, via);
  }

  /**
   * Creates a platform-specific icon (optional override)
   * @param uiFactory - Factory for creating UI elements
   * @returns Platform-specific icon or null to use default
   */
  createIcon?(_uiFactory: UIElementFactory): HTMLElement | null {
    return null; // Use default icon by default
  }

  /**
   * Cleans up any platform-specific resources (optional override)
   */
  cleanup?(): void {
    // Default: no cleanup needed
  }

  /**
   * Logs debug information with platform prefix
   * @param message - Debug message
   * @param context - Additional context
   * @protected
   */
  protected _debug(message: string, context: Record<string, unknown> = {}): void {
    debug(`[${this.name}] ${message}`, context);
  }

  /**
   * Logs warning with platform prefix
   * @param message - Warning message
   * @param errorOrContext - Error object or context
   * @protected
   */
  protected _warn(message: string, errorOrContext: Record<string, unknown> | Error = {}): void {
    const context = errorOrContext instanceof Error
      ? { error: errorOrContext.message, stack: errorOrContext.stack }
      : errorOrContext;
    warn(`[${this.name}] ${message}`, context);
  }

  /**
   * Logs error with platform prefix
   * @param message - Error message
   * @param error - Error object
   * @param context - Additional context
   * @protected
   */
  protected _error(message: string, errorObj: Error, context: Record<string, unknown> = {}): void {
    logError(`[${this.name}] ${message}`, errorObj, context);
  }
}