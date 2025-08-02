/**
 * ChatGPT Platform Strategy module
 * 
 * Strategy for handling ChatGPT's React-based textarea inputs
 * Uses React-specific event triggering for proper state updates
 */

import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

// Extended HTMLTextAreaElement interface for React property setter
interface ReactTextAreaElement extends HTMLTextAreaElement {
  _valueTracker?: {
    setValue: (value: string) => void;
  };
}

export class ChatGPTStrategy extends PlatformStrategy {
  constructor() {
    super('chatgpt', 90, {
      selectors: [
        'textarea[data-testid="chat-input"]',
        'textarea[placeholder*="Message"]',
        'textarea',
        'div[contenteditable="true"]',
        '[role="textbox"]',
        'input[type="text"]',
        '[data-testid*="input"]',
        '[class*="input"]'
      ],
      buttonContainerSelector: 'div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center',
      priority: 90
    });
  }

  /**
   * Determines if this strategy can handle the element
   * Only handles textarea elements on chatgpt.com
   */
  canHandle(element: HTMLElement): boolean {
    return this.hostname === 'chatgpt.com' && element.tagName === 'TEXTAREA';
  }

  /**
   * Inserts content using React-compatible methods
   * Uses native property setter to trigger React state updates
   */
  insert(element: HTMLElement, content: string): InsertionResult {
    try {
      const textareaElement = element as ReactTextAreaElement;
      
      // Focus the element first
      textareaElement.focus();
      
      // Set the value directly
      textareaElement.value = content;
      
      // Trigger React events for ChatGPT - this is crucial for React state updates
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
      
      this._debug('ChatGPT React insertion successful');
      return { success: true, method: 'chatgpt-react' };
    } catch (error) {
      this._warn('React insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Gets selectors for finding ChatGPT input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates ChatGPT-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createChatGPTIcon();
  }
}