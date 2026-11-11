/**
 * Base Platform Strategy module
 * 
 * Abstract base class that defines the contract for platform-specific insertion strategies.
 * Each platform must implement all abstract methods to ensure consistent behavior.
 */

import { readInputText } from '../selector/inputText';
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
    // No editing command, or the editor laid the text out differently: write it directly,
    // one <br> between two lines so the breaks show whatever the field does with spaces. A
    // last line that is empty takes a second <br>, the one that keeps it open
    const lines = text.split('\n');
    const content = document.createDocumentFragment();
    lines.forEach((line, index) => {
      if (line !== '') {
        content.append(line);
      }
      if (index < lines.length - 1) {
        content.append(document.createElement('br'));
      }
    });
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      content.append(document.createElement('br'));
    }
    element.replaceChildren(content);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    // An editor whose own handler rebuilt its content did not take the text
    if (readInputText(element) !== text) {
      return { success: false, error: 'The input field did not keep the text' };
    }
    return { success: true, method: `${via}-dom` };
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