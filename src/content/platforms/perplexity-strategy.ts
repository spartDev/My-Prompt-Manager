/**
 * Perplexity Platform Strategy module
 * 
 * Strategy for handling Perplexity.ai's contenteditable inputs
 * Uses comprehensive event triggering for various input types
 */

import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

export class PerplexityStrategy extends PlatformStrategy {
  constructor() {
    super('perplexity', 80, {
      selectors: [
        'div[contenteditable="true"][role="textbox"]#ask-input'
      ],
      buttonContainerSelector: '.bg-background-50.dark\\:bg-offsetDark.flex.items-center.justify-self-end.rounded-full.col-start-3.row-start-2',
      priority: 80
    });
  }

  /**
   * Determines if this strategy can handle the element
   * Handles any element on www.perplexity.ai
   */
  canHandle(_element: HTMLElement): boolean {
    return this.hostname === 'www.perplexity.ai';
  }

  /**
   * Inserts content using Perplexity-compatible methods
   * Handles both contenteditable divs and textarea elements
   */
  insert(element: HTMLElement, content: string): InsertionResult {
    try {
      element.focus();
      
      // Handle different element types
      if (element.contentEditable === 'true') {
        element.textContent = content;
      } else if (element.tagName === 'TEXTAREA') {
        (element as HTMLTextAreaElement).value = content;
      }
      
      // Trigger comprehensive event set that Perplexity expects
      const events = ['input', 'change', 'keyup', 'paste'];
      events.forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      this._debug('Perplexity insertion successful');
      return { success: true, method: 'perplexity-events' };
    } catch (error) {
      this._error('Perplexity insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Gets selectors for finding Perplexity input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Perplexity-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createPerplexityIcon();
  }
}