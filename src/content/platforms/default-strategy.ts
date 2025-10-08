/**
 * Default Platform Strategy module
 * 
 * Fallback strategy for unknown platforms or generic input elements
 * Provides basic insertion functionality that works with most standard inputs
 */

import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

export class DefaultStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('default', 0, {
      selectors: [
        'textarea',
        'input[type="text"]',
        'div[contenteditable="true"]',
        '[role="textbox"]'
      ],
      buttonContainerSelector: undefined, // No specific container for default
      priority: 0
    }, hostname);
  }

  /**
   * Always returns true as this is the fallback strategy
   */
  canHandle(_element: HTMLElement): boolean {
    return true; // Always can handle as fallback
  }

  /**
   * Inserts content using generic methods
   * Works with standard textarea, input, and contenteditable elements
   */
  insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      element.focus();

      // Handle different element types with basic insertion
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        inputElement.value = content;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (element.contentEditable === 'true' || element.contentEditable === 'TRUE') {
        element.textContent = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      this._debug('Default insertion successful');
      return Promise.resolve({ success: true, method: 'default' });
    } catch (error) {
      this._error('Default insertion failed', error as Error);
      return Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Gets generic selectors for finding input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Uses default floating icon
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createFloatingIcon();
  }
}