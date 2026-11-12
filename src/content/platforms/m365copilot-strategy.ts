/**
 * Microsoft 365 Copilot Platform Strategy module
 *
 * Strategy for handling Microsoft 365 Copilot's textarea inputs at m365.cloud.microsoft
 * Uses React-specific event triggering for proper state updates, similar to CopilotStrategy
 */

import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

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
      priority: 80
    }, hostname);
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
      const validation = this.validateContent(content);
      if (!validation.valid) {
        return await Promise.resolve({
          success: false,
          error: validation.error
        });
      }

      // Handle based on element type
      if (element.tagName === 'TEXTAREA') {
        // Use shared React textarea insertion from base class (includes focus)
        return await this.insertIntoReactTextarea(
          element as HTMLTextAreaElement,
          content,
          'M365 Copilot textarea',
          'm365copilot-textarea'
        );
      } else if (element.getAttribute('contenteditable') === 'true') {
        // Focus the element first for contenteditable
        element.focus();
        // Use M365-specific contenteditable insertion
        return await this._insertIntoContentEditable(element, content);
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
   * Inserts content into contenteditable elements (Lexical editor), where the caret is
   * @private
   */
  private _insertIntoContentEditable(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      const result = this.insertEditableText(element, content, 'm365copilot-contenteditable');
      if (result.success) {
        this._dispatchInputEvents(element);
        this._debug('M365 Copilot contenteditable insertion successful', { method: result.method });
      }
      return Promise.resolve(result);
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
