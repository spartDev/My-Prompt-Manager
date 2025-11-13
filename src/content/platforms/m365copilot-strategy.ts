/**
 * Microsoft 365 Copilot Platform Strategy module
 *
 * Strategy for handling Microsoft 365 Copilot's textarea inputs at m365.cloud.microsoft
 * Uses React-specific event triggering for proper state updates, similar to CopilotStrategy
 */

import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';
import { MAX_CONTENT_LENGTHS } from './constants';

// Extended HTMLTextAreaElement interface for React property setter
interface ReactTextAreaElement extends HTMLTextAreaElement {
  _valueTracker?: {
    setValue: (value: string) => void;
  };
}

export class M365CopilotStrategy extends PlatformStrategy {
  /**
   * Cached native value setter for performance optimization
   * Avoids repeated Object.getOwnPropertyDescriptor calls (~90% overhead reduction)
   */
  private static nativeValueSetter: ((this: HTMLTextAreaElement, value: string) => void) | null = null;

  /**
   * Type guard to validate a function is a valid HTMLTextAreaElement value setter
   * @param fn - The function to validate
   * @returns True if fn is a valid value setter function
   */
  private static isValueSetter(
    fn: unknown
  ): fn is (this: HTMLTextAreaElement, value: string) => void {
    return typeof fn === 'function';
  }

  constructor(hostname?: string) {
    const platform = getPlatformById('m365copilot');

    super('m365copilot', 80, {
      selectors: platform?.selectors || [
        'span[id="m365-chat-editor-target-element"]',
        'span[data-lexical-editor="true"][contenteditable="true"]',
        'span[role="combobox"][contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="Message"]'
      ],
      buttonContainerSelector: platform?.buttonContainerSelector,
      priority: 80
    }, hostname);

    // Cache the native setter on first instantiation
    if (!M365CopilotStrategy.nativeValueSetter) {
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      );
      // Store the setter - we call it with .call(element, value) to provide correct `this` context
      // Safe: We explicitly control `this` binding at call site using .call()
      // eslint-disable-next-line @typescript-eslint/unbound-method
      if (descriptor?.set && M365CopilotStrategy.isValueSetter(descriptor.set)) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        M365CopilotStrategy.nativeValueSetter = descriptor.set;
      } else {
        M365CopilotStrategy.nativeValueSetter = null;
      }
    }
  }

  /**
   * Determines if this strategy can handle the element
   * Handles both textarea and contenteditable elements on m365.cloud.microsoft
   */
  canHandle(element: HTMLElement): boolean {
    const isCorrectHostname = this.hostname === getPlatformById('m365copilot')?.hostname;
    const isTextarea = element.tagName === 'TEXTAREA';
    const isContentEditable = element.getAttribute('contenteditable') === 'true';

    return isCorrectHostname && (isTextarea || isContentEditable);
  }

  /**
   * Inserts content using React-compatible methods
   * Handles both textarea and contenteditable (Lexical) elements
   */
  insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Security: Validate input
      if (typeof content !== 'string') {
        return Promise.resolve({
          success: false,
          error: 'Invalid content type'
        });
      }

      // Security: Enforce maximum length (M365 Copilot typically has ~4000 char limit)
      if (content.length > MAX_CONTENT_LENGTHS.COPILOT) {
        this._warn(`Content exceeds maximum length (${String(content.length)} > ${String(MAX_CONTENT_LENGTHS.COPILOT)})`);
        return Promise.resolve({
          success: false,
          error: `Content exceeds maximum length of ${String(MAX_CONTENT_LENGTHS.COPILOT)} characters`
        });
      }

      // Security: Sanitize control characters (preserve newlines, tabs, carriage returns)
      // eslint-disable-next-line no-control-regex
      const sanitized = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

      // Focus the element first
      element.focus();

      // Handle based on element type
      if (element.tagName === 'TEXTAREA') {
        return this._insertIntoTextarea(element as ReactTextAreaElement, sanitized);
      } else if (element.getAttribute('contenteditable') === 'true') {
        return this._insertIntoContentEditable(element, sanitized);
      } else {
        return Promise.resolve({
          success: false,
          error: 'Unsupported element type'
        });
      }
    } catch (error) {
      this._warn('Insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Inserts content into textarea elements using React-compatible methods
   * @private
   */
  private _insertIntoTextarea(element: ReactTextAreaElement, content: string): Promise<InsertionResult> {
    try {
      // Set the sanitized value
      element.value = content;

      // Trigger React events for M365 Copilot using cached native setter
      if (M365CopilotStrategy.nativeValueSetter) {
        M365CopilotStrategy.nativeValueSetter.call(element, content);
      }

      // Dispatch events that React expects
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      this._debug('M365 Copilot textarea insertion successful');
      return Promise.resolve({ success: true, method: 'm365copilot-textarea' });
    } catch (error) {
      this._warn('Textarea insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Inserts content into contenteditable elements (Lexical editor)
   * Clears existing content before inserting to replace rather than append
   * @private
   */
  private _insertIntoContentEditable(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Get or create selection
      const selection = window.getSelection();
      if (!selection) {
        return Promise.resolve({
          success: false,
          error: 'Could not get selection'
        });
      }

      // Select all existing content in the editor to replace it
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);

      // Method 1: Try execCommand with selected content (works in most browsers)
      // This will replace the selected content with the new prompt
      const execCommandSuccess = document.execCommand('insertText', false, content);

      if (execCommandSuccess) {
        // Dispatch events that Lexical expects
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        this._debug('M365 Copilot contenteditable insertion successful (execCommand)');
        return Promise.resolve({ success: true, method: 'm365copilot-contenteditable-execCommand' });
      }

      // Method 2: Direct DOM manipulation fallback
      // First delete all selected content (which is everything in the editor)
      range.deleteContents();

      // Insert text node
      const textNode = document.createTextNode(content);
      range.insertNode(textNode);

      // Move cursor to end
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      // Dispatch events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      this._debug('M365 Copilot contenteditable insertion successful (DOM)');
      return Promise.resolve({ success: true, method: 'm365copilot-contenteditable-dom' });
    } catch (error) {
      this._warn('Contenteditable insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Gets selectors for finding M365 Copilot input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates M365 Copilot-specific icon using the UI factory
   * Reuses the Copilot icon as they share the same branding
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createCopilotIcon();
  }
}
