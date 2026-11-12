/**
 * Claude Platform Strategy module
 * 
 * Strategy for handling Claude.ai's ProseMirror editor
 * Supports multiple insertion methods with fallbacks
 */

import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { PlatformStrategy } from './base-strategy';

// ProseMirror view interface for TypeScript
interface ProseMirrorView {
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
}

// Extended HTMLElement interface for ProseMirror elements
interface ProseMirrorElement extends HTMLElement {
  pmViewDesc?: { view: ProseMirrorView };
  _pmViewDesc?: { view: ProseMirrorView };
}

// Global ProseMirror interface
declare global {
  interface Window {
    ProseMirror?: {
      view: ProseMirrorView;
    };
  }
}

export class ClaudeStrategy extends PlatformStrategy {
  constructor(hostname?: string) {
    super('claude', 100, {
      selectors: [
        'div[contenteditable="true"][role="textbox"].ProseMirror'
      ],
      priority: 100
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element
   * Always returns true for claude.ai to ensure Claude strategy is used
   */
  canHandle(_element: HTMLElement): boolean {
    // Only handle elements on Claude (defense-in-depth)
    if (this.hostname !== getPlatformById('claude')?.hostname) {
      return false;
    }
    
    // For Claude, we want to handle any element that is or is related to ProseMirror
    return true; // Always return true for claude.ai to ensure we use Claude strategy
  }

  /**
   * Inserts content where the caret is, using Claude-specific methods: the ProseMirror
   * transaction API when the editor's view can be reached, then the browser's editing command.
   * When neither takes the text, the Insertion fails: nothing is written over what the field holds.
   */
  insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Try to find ProseMirror element
    const proseMirrorElement = this._findProseMirrorElement(element);
    
    // Method 1: Try ProseMirror transaction API
    const transactionResult = this._tryProseMirrorTransaction(proseMirrorElement, content);
    if (transactionResult.success) {return Promise.resolve(transactionResult);}
    
    // Method 2: the editing command, as typing would
    return this._tryExecCommand(proseMirrorElement, element, content);
  }

  /**
   * Gets selectors for finding Claude input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Claude-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createClaudeIcon();
  }

  /**
   * Finds the ProseMirror element from the given element
   * @param element - Starting element
   * @returns ProseMirror element or original element
   * @private
   */
  private _findProseMirrorElement(element: HTMLElement): HTMLElement {
    // If element is already ProseMirror, use it
    if (element.classList.contains('ProseMirror')) {
      return element;
    }
    
    // First check if ProseMirror is a parent
    const parentProseMirror = element.closest('.ProseMirror');
    if (parentProseMirror) {
      return parentProseMirror as HTMLElement;
    }

    // Then check if ProseMirror is a child
    const childProseMirror = element.querySelector('.ProseMirror');
    if (childProseMirror) {
      return childProseMirror as HTMLElement;
    }

    // Last resort: find any ProseMirror element on the page for Claude.ai
    const anyProseMirror = document.querySelector('div[contenteditable="true"][role="textbox"].ProseMirror');
    if (anyProseMirror) {
      return anyProseMirror as HTMLElement;
    }
    
    // Return original element as final fallback
    return element;
  }

  /**
   * Attempts insertion using ProseMirror transaction API
   * @param proseMirrorElement - ProseMirror element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   * @private
   */
  private _tryProseMirrorTransaction(proseMirrorElement: HTMLElement, content: string): InsertionResult {
    try {
      const pmElement = proseMirrorElement as ProseMirrorElement;
      const view = pmElement.pmViewDesc?.view || 
                  pmElement._pmViewDesc?.view ||
                  window.ProseMirror?.view;
      
      if (view) {
        const { state } = view;
        const { selection } = state;
        const transaction = state.tr.insertText(content, selection.from, selection.to);
        view.dispatch(transaction);
        
        // Trigger events for Claude
        proseMirrorElement.dispatchEvent(new Event('input', { bubbles: true }));
        proseMirrorElement.dispatchEvent(new Event('compositionend', { bubbles: true }));
        
        return { success: true, method: 'prosemirror-transaction' };
      }
    } catch (error) {
      this._warn('ProseMirror transaction failed', error instanceof Error ? error : { error: String(error) });
    }
    
    return { success: false };
  }

  /**
   * Attempts insertion at the caret through the browser's editing command
   * @param proseMirrorElement - ProseMirror element
   * @param element - Original element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   * @private
   */
  private async _tryExecCommand(proseMirrorElement: HTMLElement, element: HTMLElement, content: string): Promise<InsertionResult> {
    const targetEl = [proseMirrorElement, element].find(ClaudeStrategy._isEditable);
    if (!targetEl) {
      return { success: false, error: 'The input field holds no editable text' };
    }
    try {
      targetEl.focus();

      // For Claude, we need to ensure the editor is ready
      targetEl.click();

      // Wait a tiny bit for focus
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = this.insertEditableText(targetEl, content, 'claude');
      if (!result.success) {
        return result;
      }

      // Trigger Claude-specific events. A direct write has already told the page of its input
      const inputEvent = result.method === 'claude-execCommand'
        ? new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: content })
        : null;
      // For Claude, also trigger these events on the parent contenteditable if different
      for (const heardBy of targetEl === element ? [targetEl] : [targetEl, element]) {
        if (inputEvent) {
          heardBy.dispatchEvent(inputEvent);
        }
        heardBy.dispatchEvent(new Event('compositionend', { bubbles: true }));
      }
      return result;
    } catch (error) {
      this._error('All insertion methods failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  private static _isEditable(element: HTMLElement): boolean {
    return element.isContentEditable || element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true';
  }
}