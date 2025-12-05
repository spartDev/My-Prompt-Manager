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
      buttonContainerSelector: '.relative.flex-1.flex.items-center.gap-2.shrink.min-w-0',
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
   * Inserts content using Claude-specific methods
   * Tries ProseMirror transaction API, then execCommand, then DOM manipulation
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    // Try to find ProseMirror element
    const proseMirrorElement = this._findProseMirrorElement(element);
    
    // Method 1: Try ProseMirror transaction API
    const transactionResult = this._tryProseMirrorTransaction(proseMirrorElement, content);
    if (transactionResult.success) {return transactionResult;}
    
    // Method 2: Try execCommand for contentEditable
    const execCommandResult = await this._tryExecCommand(proseMirrorElement, element, content);
    if (execCommandResult.success) {return execCommandResult;}
    
    // Method 3: Direct DOM manipulation
    return this._tryDOMManipulation(element, content);
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
    const result = uiFactory.createClaudeIcon();
    // createClaudeIcon returns { container, icon }, we want the container for Claude
    return result.container;
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
   * Attempts insertion using execCommand
   * @param proseMirrorElement - ProseMirror element
   * @param element - Original element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   * @private
   */
  private async _tryExecCommand(proseMirrorElement: HTMLElement, element: HTMLElement, content: string): Promise<InsertionResult> {
    if (proseMirrorElement.contentEditable === 'true' || element.contentEditable === 'true') {
      try {
        const targetEl = proseMirrorElement.contentEditable === 'true' ? proseMirrorElement : element;
        targetEl.focus();
        
        // For Claude, we need to ensure the editor is ready
        targetEl.click();
        
        // Wait a tiny bit for focus
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Clear existing content if it's placeholder text
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        
        // Insert new content using execCommand
        const inserted = document.execCommand('insertText', false, content);
        
        if (inserted) {
          // Trigger Claude-specific events
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: content
          });
          targetEl.dispatchEvent(inputEvent);
          targetEl.dispatchEvent(new Event('compositionend', { bubbles: true }));
          
          // For Claude, also trigger these events on the parent contenteditable if different
          if (targetEl !== element) {
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(new Event('compositionend', { bubbles: true }));
          }
          
          return { success: true, method: 'execCommand' };
        }
      } catch (error) {
        this._warn('execCommand failed', error instanceof Error ? error : { error: String(error) });
      }
    }
    
    return { success: false };
  }

  /**
   * Attempts insertion using direct DOM manipulation
   * @param element - Target element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   * @private
   */
  private _tryDOMManipulation(element: HTMLElement, content: string): InsertionResult {
    try {
      element.focus();
      element.textContent = content;
      
      // Create and dispatch a comprehensive set of events
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: content
      });
      element.dispatchEvent(inputEvent);
      
      // Additional events that Claude might listen to
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur-sm', { bubbles: true }));
      element.dispatchEvent(new Event('focus', { bubbles: true }));
      
      return { success: true, method: 'dom-manipulation' };
    } catch (error) {
      this._error('All insertion methods failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }
}