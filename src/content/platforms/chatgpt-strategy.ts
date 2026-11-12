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
   * Inserts content where the caret is: into the editor through the browser's editing command,
   * so its paragraphs follow the Prompt's line breaks, or into the textarea through the native
   * value setter React listens to
   */
  insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      if (ChatGPTStrategy.isEditable(element)) {
        return Promise.resolve(this.insertEditableText(element, content, 'chatgpt'));
      }

      // Through the native value setter, which is what makes React see the change
      // A page whose own handler rewrote the value did not take the text
      if (!this.insertIntoTextControl(element as HTMLTextAreaElement, content)) {
        return Promise.resolve({ success: false, error: 'The input field did not keep the text' });
      }

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