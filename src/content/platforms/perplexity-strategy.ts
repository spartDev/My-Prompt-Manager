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
      buttonContainerSelector: '.bg-raised.flex.items-center.justify-self-end.rounded-full',
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
   * Uses multiple insertion approaches for better compatibility
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Focus the element first
      element.focus();
      element.click();
      
      // Wait a moment for Perplexity to initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Method 1: Try execCommand approach
      const execCommandResult = await this._tryExecCommand(element, content);
      if (execCommandResult.success) {
        return execCommandResult;
      }
      
      // Method 2: Try selection and replacement
      const selectionResult = this._trySelectionReplacement(element, content);
      if (selectionResult.success) {
        return selectionResult;
      }
      
      // Method 3: Direct DOM manipulation as fallback
      return this._tryDirectManipulation(element, content);
      
    } catch (error) {
      this._error('Perplexity insertion failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Attempts insertion using execCommand
   */
  private async _tryExecCommand(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Select all existing content
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      // Wait for selection to be ready
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Use execCommand to insert text
      const inserted = document.execCommand('insertText', false, content);
      
      if (inserted) {
        // Trigger Perplexity-specific events
        this._triggerPerplexityEvents(element, content);
        this._debug('Perplexity execCommand insertion successful');
        return { success: true, method: 'perplexity-execCommand' };
      }
    } catch (error) {
      this._warn('execCommand method failed', error);
    }
    
    return { success: false };
  }

  /**
   * Attempts insertion using selection replacement
   */
  private _trySelectionReplacement(element: HTMLElement, content: string): InsertionResult {
    try {
      // Create a text node with the content
      const textNode = document.createTextNode(content);
      
      // Clear existing content and add new content
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      element.appendChild(textNode);
      
      // Set cursor at the end
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      this._triggerPerplexityEvents(element, content);
      this._debug('Perplexity selection replacement successful');
      return { success: true, method: 'perplexity-selection' };
    } catch (error) {
      this._warn('Selection replacement method failed', error);
      return { success: false };
    }
  }

  /**
   * Attempts direct DOM manipulation as final fallback
   */
  private _tryDirectManipulation(element: HTMLElement, content: string): InsertionResult {
    try {
      // Simple textContent assignment
      element.textContent = content;
      
      // Trigger comprehensive event set
      this._triggerPerplexityEvents(element, content);
      
      this._debug('Perplexity direct manipulation successful');
      return { success: true, method: 'perplexity-direct' };
    } catch (error) {
      this._error('All Perplexity insertion methods failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Triggers events that Perplexity expects to detect content changes
   */
  private _triggerPerplexityEvents(element: HTMLElement, content: string): void {
    // Create input event with proper data
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content
    });
    element.dispatchEvent(inputEvent);
    
    // Additional events that Perplexity might listen for
    const events = ['change', 'keyup', 'compositionend', 'blur', 'focus'];
    events.forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
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