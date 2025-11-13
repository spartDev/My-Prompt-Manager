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
    const { element, cleanup } = uiFactory.createCopilotIcon();
    // Store cleanup function on element for later retrieval by injector
    (element as HTMLElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return element;
  }
}
