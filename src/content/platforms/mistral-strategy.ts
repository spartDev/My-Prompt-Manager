import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

// Constants for timing values
const MISTRAL_FOCUS_DELAY_MS = 50;

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
  constructor() {
    super('mistral', 85, {
      selectors: [
        '.ProseMirror[contenteditable="true"]',
        'div.ProseMirror[data-placeholder*="Ask"]',
        '[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"]',
        'textarea',
        '[role="textbox"]'
      ],
      // Target the exact button container from Mistral's DOM structure
      buttonContainerSelector: [
        '.flex.w-full.max-w-full.items-center.justify-start.gap-3', // Main chat interface
        '.flex.w-full.items-center.justify-start.gap-3',           // Compact view
        '.flex.items-center.justify-start.gap-3'                   // Mobile fallback
      ].join(', '),
      priority: 85
    });
  }

  canHandle(_element: HTMLElement): boolean {
    const canHandle = this.hostname === 'chat.mistral.ai';
    this._debug(`canHandle called for hostname: ${this.hostname}, result: ${String(canHandle)}`);
    return canHandle;
  }

  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    const proseMirrorElement = this._findProseMirrorElement(element);

    const proseMirrorResult = this._tryProseMirrorInsertion(proseMirrorElement, content);
    if (proseMirrorResult.success) {return proseMirrorResult;}

    const execCommandResult = await this._tryExecCommand(proseMirrorElement, content);
    if (execCommandResult.success) {return execCommandResult;}

    return this._tryDOMManipulation(proseMirrorElement, content);
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
      element.focus();
      element.textContent = content;

      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: content
      });
      element.dispatchEvent(inputEvent);

      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      element.dispatchEvent(new Event('focus', { bubbles: true }));

      this._debug('DOM manipulation insertion successful');
      return { success: true, method: 'mistral-dom-manipulation' };
    } catch (error) {
      this._error('All insertion methods failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }
}