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

// Extended HTMLTextAreaElement interface for React property setter
interface ReactTextAreaElement extends HTMLTextAreaElement {
  _valueTracker?: {
    setValue: (value: string) => void;
  };
}

export class CopilotStrategy extends PlatformStrategy {
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
      const textareaElement = element as ReactTextAreaElement;

      // Focus the element first
      textareaElement.focus();

      // Set the value directly
      textareaElement.value = content;

      // Trigger React events for Copilot - this is crucial for React state updates
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      );
      const nativeInputValueSetter = descriptor?.set?.bind(textareaElement) as ((value: string) => void) | undefined;

      if (nativeInputValueSetter) {
        nativeInputValueSetter(content);
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
