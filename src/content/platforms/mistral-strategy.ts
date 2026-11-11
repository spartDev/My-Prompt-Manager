import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

// Constants for platform configuration
const MISTRAL_PLATFORM_PRIORITY = 85;

export class MistralStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('Mistral', MISTRAL_PLATFORM_PRIORITY, {
      selectors: [
        'div[contenteditable="true"]',
        'textarea[placeholder*="chat"]',
        '[role="textbox"]'
      ],
      buttonContainerSelector: getPlatformById('mistral')?.buttonContainerSelector,
      priority: MISTRAL_PLATFORM_PRIORITY
    }, hostname);
  }

  canHandle(element: HTMLElement): boolean {
    // Only handle elements on Mistral (defense-in-depth)
    if (this.hostname !== getPlatformById('mistral')?.hostname) {
      return false;
    }

    if (element.tagName === 'TEXTAREA' &&
        element.hasAttribute('placeholder') &&
        element.getAttribute('placeholder')?.toLowerCase().includes('chat')) {
      return true;
    }

    if (element.contentEditable === 'true' &&
        (element.classList.contains('ProseMirror') || element.querySelector('.ProseMirror'))) {
      return true;
    }

    if (element.getAttribute('role') === 'textbox') {
      return true;
    }

    return false;
  }

  /**
   * Inserts content into Mistral's ProseMirror editor through the browser's editing command, so
   * its paragraphs follow the Prompt's line breaks; a textarea takes it as its value.
   */
  insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    const target = this._findProseMirrorElement(element);
    try {
      if (target.tagName === 'TEXTAREA') {
        const textarea = target as HTMLTextAreaElement;
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.focus();

        this._debug('Textarea manipulation successful');
        return Promise.resolve({ success: true, method: 'mistral-textarea' });
      }

      if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
        return Promise.resolve(this.replaceEditableText(target, content, 'mistral'));
      }

      this._warn('Element is not suitable for insertion', {
        tagName: target.tagName,
        contentEditable: target.contentEditable
      });
    } catch (error) {
      this._error('Insertion failed', error as Error);
    }

    return Promise.resolve({ success: false });
  }

  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createMistralIcon();
  }


  private _findProseMirrorElement(element: HTMLElement): HTMLElement {
    if (element.classList.contains('ProseMirror')) {
      return element;
    }

    const parentProseMirror = element.closest('.ProseMirror');
    if (parentProseMirror) {
      return parentProseMirror as HTMLElement;
    }

    const childProseMirror = element.querySelector('.ProseMirror');
    if (childProseMirror) {
      return childProseMirror as HTMLElement;
    }

    const anyProseMirror = document.querySelector('.ProseMirror[contenteditable="true"]');
    if (anyProseMirror) {
      return anyProseMirror as HTMLElement;
    }

    return element;
  }
}
