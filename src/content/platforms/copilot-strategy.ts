/**
 * Microsoft Copilot Platform Strategy module
 *
 * Strategy for handling Microsoft Copilot's textarea inputs
 * Uses React-specific event triggering for proper state updates
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

export class CopilotStrategy extends PlatformStrategy {
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
    const platform = getPlatformById('copilot');

    super('copilot', 80, {
      selectors: platform?.selectors || [
        'textarea[data-testid="composer-input"]',
        'textarea#userInput',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Copilot"]'
      ],
      buttonContainerSelector: platform?.buttonContainerSelector,
      priority: 80
    }, hostname);

    // Cache the native setter on first instantiation
    if (!CopilotStrategy.nativeValueSetter) {
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      );
      // Store the setter - we call it with .call(element, value) to provide correct `this` context
      // Safe: We explicitly control `this` binding at call site using .call()
      // eslint-disable-next-line @typescript-eslint/unbound-method
      if (descriptor?.set && CopilotStrategy.isValueSetter(descriptor.set)) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        CopilotStrategy.nativeValueSetter = descriptor.set;
      } else {
        CopilotStrategy.nativeValueSetter = null;
      }
    }
  }

  /**
   * Determines if this strategy can handle the element
   * Only handles textarea elements on copilot.microsoft.com
   */
  canHandle(element: HTMLElement): boolean {
    return this.hostname === getPlatformById('copilot')?.hostname && element.tagName === 'TEXTAREA';
  }

  /**
   * Inserts content using React-compatible methods
   * Uses native property setter to trigger React state updates
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

      // Security: Enforce maximum length (Copilot typically has ~4000 char limit)
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

      const textareaElement = element as ReactTextAreaElement;

      // Focus the element first
      textareaElement.focus();

      // Set the sanitized value
      textareaElement.value = sanitized;

      // Trigger React events for Copilot using cached native setter
      if (CopilotStrategy.nativeValueSetter) {
        CopilotStrategy.nativeValueSetter.call(textareaElement, sanitized);
      }

      // Dispatch events that React expects
      textareaElement.dispatchEvent(new Event('input', { bubbles: true }));
      textareaElement.dispatchEvent(new Event('change', { bubbles: true }));

      this._debug('Copilot React insertion successful');
      return Promise.resolve({ success: true, method: 'copilot-react' });
    } catch (error) {
      this._warn('React insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Gets selectors for finding Copilot input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Copilot-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createCopilotIcon();
  }
}
