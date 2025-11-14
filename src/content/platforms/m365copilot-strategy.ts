/**
 * Microsoft 365 Copilot Platform Strategy module
 *
 * Strategy for handling Microsoft 365 Copilot's textarea inputs at m365.cloud.microsoft
 * Uses React-specific event triggering for proper state updates, similar to CopilotStrategy
 */

import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { MAX_CONTENT_LENGTHS } from './constants';
import { ReactPlatformStrategy } from './react-platform-strategy';

export class M365CopilotStrategy extends ReactPlatformStrategy {
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

    // Initialize React native value setter cache
    ReactPlatformStrategy.initializeNativeValueSetter();
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
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Validate and sanitize content
      const validation = this.validateAndSanitize(content, MAX_CONTENT_LENGTHS.COPILOT);
      if (!validation.valid) {
        return await Promise.resolve({
          success: false,
          error: validation.error
        });
      }

      // Validation ensures sanitized is defined (allow empty strings)
      if (typeof validation.sanitized !== 'string') {
        return await Promise.resolve({
          success: false,
          error: 'Content sanitization failed'
        });
      }

      const sanitized = validation.sanitized;

      // Handle based on element type
      if (element.tagName === 'TEXTAREA') {
        // Use shared React textarea insertion from base class (includes focus)
        return await this.insertIntoReactTextarea(
          element as HTMLTextAreaElement,
          sanitized,
          'M365 Copilot textarea',
          'm365copilot-textarea'
        );
      } else if (element.getAttribute('contenteditable') === 'true') {
        // Focus the element first for contenteditable
        element.focus();
        // Use M365-specific contenteditable insertion
        return await this._insertIntoContentEditable(element, sanitized);
      } else {
        return await Promise.resolve({
          success: false,
          error: 'Unsupported element type'
        });
      }
    } catch (error) {
      this._warn('Insertion failed', error as Error);
      return await Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Inserts content into contenteditable elements (Lexical editor)
   * Clears existing content before inserting to replace rather than append
   * @private
   */
  private _insertIntoContentEditable(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Prepare selection - select all content for replacement
      const selection = this._prepareSelection(element);
      if (!selection) {
        return Promise.resolve({
          success: false,
          error: 'Could not get selection'
        });
      }

      // Try execCommand first (better browser support)
      const execResult = this._tryExecCommandInsertion(element, content, selection);
      if (execResult.success) {
        return Promise.resolve(execResult);
      }

      // Fallback to direct DOM manipulation
      return Promise.resolve(this._tryDOMInsertion(element, content, selection));
    } catch (error) {
      this._warn('Contenteditable insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Dispatches input and change events for Lexical editor synchronization
   * @private
   */
  private _dispatchInputEvents(element: HTMLElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Prepares selection by selecting all content in the editor
   * This is intentional - replaces all existing content rather than inserting at cursor
   * @private
   * @returns Selection object or null if unavailable
   */
  private _prepareSelection(element: HTMLElement): Selection | null {
    const selection = window.getSelection();
    if (!selection) {
      return null;
    }

    // Select all existing content in the editor to replace it
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    return selection;
  }

  /**
   * Attempts to insert content using execCommand API
   * This is the preferred method as it works in most browsers
   * @private
   * @returns Insertion result with success status and method identifier
   */
  private _tryExecCommandInsertion(
    element: HTMLElement,
    content: string,
    _selection: Selection
  ): InsertionResult {
    // Try execCommand with selected content (works in most browsers)
    // This will replace the selected content with the new prompt
    const success = document.execCommand('insertText', false, content);

    if (success) {
      this._dispatchInputEvents(element);
      this._debug('M365 Copilot contenteditable insertion successful (execCommand)');
      return {
        success: true,
        method: 'm365copilot-contenteditable-execCommand'
      };
    }

    return { success: false };
  }

  /**
   * Inserts content using direct DOM manipulation as fallback
   * Used when execCommand is not supported or fails
   * @private
   * @returns Insertion result with success status and method identifier
   */
  private _tryDOMInsertion(
    element: HTMLElement,
    content: string,
    selection: Selection
  ): InsertionResult {
    const range = selection.getRangeAt(0);

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

    this._dispatchInputEvents(element);
    this._debug('M365 Copilot contenteditable insertion successful (DOM)');

    return {
      success: true,
      method: 'm365copilot-contenteditable-dom'
    };
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
    const { element, cleanup } = uiFactory.createCopilotIcon();
    // Store cleanup function on element for later retrieval by injector
    (element as HTMLElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return element;
  }
}
