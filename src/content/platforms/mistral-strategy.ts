import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { sanitizeUserInput } from '../utils/storage';

import { PlatformStrategy } from './base-strategy';

// Constants for timing values
const MISTRAL_FOCUS_DELAY_MS = 50;

// Constants for platform configuration
const MISTRAL_PLATFORM_PRIORITY = 85;

interface ProseMirrorElement extends HTMLElement {
  _pmViewDesc?: {
    view: {
      state: {
        tr: {
          insertText(text: string, from?: number, to?: number): unknown;
        };
        selection: {
          from: number;
          to: number;
        };
      };
      dispatch(transaction: unknown): void;
    };
  };
}

export class MistralStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('Mistral', MISTRAL_PLATFORM_PRIORITY, {
      selectors: [
        'div[contenteditable="true"]',
        'textarea[placeholder*="chat"]',
        '[role="textbox"]'
      ],
      // Target the exact button container from Mistral's DOM structure
      buttonContainerSelector: [
        '.flex.w-full.max-w-full.items-center.justify-start.gap-3', // Main chat interface
        '.flex.w-full.items-center.justify-start.gap-3',           // Compact view
        '.flex.items-center.justify-start.gap-3'                   // Mobile fallback
      ].join(', '),
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

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Sanitize content before any insertion attempts
    const sanitizedContent = sanitizeUserInput(content);
    
    if (!sanitizedContent) {
      this._warn('Content sanitization resulted in empty content', { 
        originalLength: content.length,
        wasEmpty: content.length === 0
      });
      return { 
        success: false, 
        error: 'Content could not be sanitized safely' 
      };
    }

    if (sanitizedContent !== content) {
      this._debug('Content was sanitized during insertion', {
        originalLength: content.length,
        sanitizedLength: sanitizedContent.length,
        contentModified: true
      });
    }

    const proseMirrorElement = this._findProseMirrorElement(element);

    const proseMirrorResult = this._tryProseMirrorInsertion(proseMirrorElement, sanitizedContent);
    if (proseMirrorResult.success) {return proseMirrorResult;}

    const execCommandResult = await this._tryExecCommand(proseMirrorElement, sanitizedContent);
    if (execCommandResult.success) {return execCommandResult;}

    return this._tryDOMManipulation(proseMirrorElement, sanitizedContent);
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

  private _tryProseMirrorInsertion(element: HTMLElement, content: string): InsertionResult {
    try {
      const pElement = element.querySelector('p');
      if (pElement) {
        pElement.textContent = content;

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.focus();

        this._debug('ProseMirror paragraph insertion successful');
        return { success: true, method: 'mistral-prosemirror-p' };
      }

      const pmElement = element as ProseMirrorElement;
      const view = pmElement._pmViewDesc?.view;

      if (view) {
        const { state } = view;
        const { selection } = state;
        const transaction = state.tr.insertText(content, selection.from, selection.to);
        view.dispatch(transaction);

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        this._debug('ProseMirror transaction insertion successful');
        return { success: true, method: 'mistral-prosemirror-transaction' };
      }
    } catch (error) {
      this._warn('ProseMirror insertion failed', error instanceof Error ? error : { error: String(error) });
    }

    return { success: false };
  }

  private async _tryExecCommand(element: HTMLElement, content: string): Promise<InsertionResult> {
    if (element.contentEditable === 'true' &&
        (element.classList.contains('ProseMirror') || element.closest('.ProseMirror'))) {
      try {
        element.focus();
        element.click();

        await new Promise(resolve => setTimeout(resolve, MISTRAL_FOCUS_DELAY_MS));

        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        const inserted = document.execCommand('insertText', false, content);

        if (inserted) {
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: content
          });
          element.dispatchEvent(inputEvent);
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('compositionend', { bubbles: true }));

          this._debug('execCommand insertion successful');
          return { success: true, method: 'mistral-execCommand' };
        }
      } catch (error) {
        this._warn('execCommand failed', error instanceof Error ? error : { error: String(error) });
      }
    }

    return { success: false };
  }

  private _tryDOMManipulation(element: HTMLElement, content: string): InsertionResult {
    try {
      if (element.tagName === 'TEXTAREA') {
        const textarea = element as HTMLTextAreaElement;
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.focus();

        this._debug('Textarea manipulation successful');
        return { success: true, method: 'mistral-textarea' };
      }

      if (element.contentEditable === 'true') {
        // Create a text node for safe insertion
        const textNode = document.createTextNode(content);
        
        // Clear existing content and insert new content
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }
        element.appendChild(textNode);

        // Dispatch events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.focus();

        this._debug('ContentEditable manipulation successful');
        return { success: true, method: 'mistral-contenteditable' };
      }

      this._warn('Element is not suitable for DOM manipulation', {
        tagName: element.tagName,
        contentEditable: element.contentEditable,
        hasTextarea: element.tagName === 'TEXTAREA'
      });

    } catch (error) {
      this._error('DOM manipulation failed', error as Error);
    }

    return { success: false };
  }
}