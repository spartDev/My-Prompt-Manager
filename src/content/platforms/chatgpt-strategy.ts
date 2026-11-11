/**
 * ChatGPT Platform Strategy module
 * 
 * Strategy for ChatGPT's composer: a ProseMirror contenteditable on the live site, a React
 * textarea before that and still on some pages.
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

export class ChatGPTStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
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
      priority: 90
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element: the composer on chatgpt.com, as a
   * textarea or as a contenteditable editor
   */
  canHandle(element: HTMLElement): boolean {
    if (this.hostname !== getPlatformById('chatgpt')?.hostname) {
      return false;
    }
    return element.tagName === 'TEXTAREA' || ChatGPTStrategy.isEditable(element);
  }

  private static isEditable(element: HTMLElement): boolean {
    return element.isContentEditable || element.getAttribute('contenteditable') === 'true';
  }

  /**
   * Inserts content: into the editor through the browser's editing command, so its paragraphs
   * follow the Prompt's line breaks, or into the textarea through the native value setter React
   * listens to
   */
  insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      if (ChatGPTStrategy.isEditable(element)) {
        return Promise.resolve(this.replaceEditableText(element, content, 'chatgpt'));
      }

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
      return Promise.resolve({ success: true, method: 'chatgpt-react' });
    } catch (error) {
      this._warn('React insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
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