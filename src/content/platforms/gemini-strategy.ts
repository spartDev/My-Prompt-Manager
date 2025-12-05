/**
 * Gemini Platform Strategy
 * Implements content insertion for Google Gemini (gemini.google.com)
 * Uses Quill.js editor with 3-tier fallback chain
 */

import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { sanitizeUserInput } from '../utils/storage';

import { PlatformStrategy } from './base-strategy';

// Constants for timing values
const GEMINI_FOCUS_DELAY_MS = 50;

// Constants for platform configuration
const GEMINI_PLATFORM_PRIORITY = 85;

/**
 * Quill editor instance interface
 * Gemini uses Quill.js for rich text editing
 */
interface QuillEditor {
  setText(text: string): void;
  insertText(index: number, text: string): void;
  getLength(): number;
  setSelection(index: number, length?: number): void;
  root: HTMLElement;
}

/**
 * Extended HTMLElement with Quill instance
 */
interface QuillElement extends HTMLElement {
  __quill?: QuillEditor;
  quill?: QuillEditor;
}

/**
 * GeminiStrategy handles content insertion for Google Gemini's Quill.js-based editor
 *
 * Insertion Strategy:
 * 1. Quill.js API (primary) - Direct Quill instance manipulation
 * 2. execCommand (secondary) - contenteditable fallback
 * 3. DOM manipulation (tertiary) - Direct text node insertion
 *
 * Performance Optimization:
 * - Caches Quill editor references using WeakMap for automatic garbage collection
 * - Reduces expensive page-wide DOM queries
 */
export class GeminiStrategy extends PlatformStrategy {
  /**
   * Cache for Quill editor element lookups
   * Uses WeakMap for automatic garbage collection when elements are removed
   */
  private _quillEditorCache: WeakMap<HTMLElement, HTMLElement | null> = new WeakMap();

  /**
   * Timestamp of last page-wide Quill search
   * Used to throttle expensive querySelector operations
   */
  private _lastPageWideSearchTime = 0;

  /**
   * Minimum time (ms) between page-wide Quill searches
   * Prevents excessive DOM queries on rapid insertions
   */
  private static readonly PAGE_WIDE_SEARCH_THROTTLE_MS = 1000;

  constructor(hostname?: string) {
    super('Gemini', GEMINI_PLATFORM_PRIORITY, {
      selectors: [
        'div.ql-editor[contenteditable="true"][role="textbox"]',
        'rich-textarea .ql-editor',
        '[data-placeholder*="Gemini"]',
        'div[contenteditable="true"]'
      ],
      // Target the button container where mic and send buttons are located
      buttonContainerSelector: '.input-buttons-wrapper-bottom',
      priority: GEMINI_PLATFORM_PRIORITY
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element
   * Checks for Gemini hostname and Quill editor presence
   */
  canHandle(element: HTMLElement): boolean {
    // Only handle elements on gemini.google.com (defense-in-depth)
    if (this.hostname !== getPlatformById('gemini')?.hostname) {
      return false;
    }

    // Check if element is or contains a Quill editor
    if (element.classList.contains('ql-editor')) {
      return true;
    }

    // Check if element has Quill-specific attributes
    if (element.hasAttribute('data-placeholder') &&
        element.getAttribute('data-placeholder')?.includes('Gemini')) {
      return true;
    }

    // Check if parent or child is a Quill editor
    const hasQuillParent = element.closest('.ql-editor') !== null;
    const hasQuillChild = element.querySelector('.ql-editor') !== null;

    return hasQuillParent || hasQuillChild;
  }

  /**
   * Inserts content using Gemini-specific methods
   * Tries Quill.js API, then execCommand, then DOM manipulation
   */
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

    // Find the Quill editor element
    const quillElement = this._findQuillEditor(element);

    // Method 1: Try Quill.js API
    const quillResult = this._tryQuillInsertion(quillElement, sanitizedContent);
    if (quillResult.success) {
      return quillResult;
    }

    // Method 2: Try execCommand for contenteditable
    const execCommandResult = await this._tryExecCommand(quillElement, sanitizedContent);
    if (execCommandResult.success) {
      return execCommandResult;
    }

    // Method 3: Direct DOM manipulation
    return this._tryDOMManipulation(quillElement, sanitizedContent);
  }

  /**
   * Gets selectors for finding Gemini input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Gemini-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createGeminiIcon();
  }

  /**
   * Finds the Quill editor element from the given element
   * Uses caching to optimize repeated lookups and throttles expensive page-wide searches
   * @param element - Starting element
   * @returns Quill editor element or original element
   * @private
   */
  private _findQuillEditor(element: HTMLElement): HTMLElement {
    // Check cache first for fast lookup
    const cachedEditor = this._quillEditorCache.get(element);
    if (cachedEditor) {
      // Verify cached element is still in DOM
      if (document.contains(cachedEditor)) {
        this._debug('Quill editor found in cache', {
          elementTag: element.tagName,
          cachedTag: cachedEditor.tagName
        });
        return cachedEditor;
      } else {
        // Clear stale cache entry
        this._quillEditorCache.delete(element);
      }
    }

    // If element is already the Quill editor, cache and return
    if (element.classList.contains('ql-editor')) {
      this._quillEditorCache.set(element, element);
      return element;
    }

    // Check if Quill editor is a parent
    const parentQuill = element.closest('.ql-editor');
    if (parentQuill) {
      const quillElement = parentQuill as HTMLElement;
      this._quillEditorCache.set(element, quillElement);
      return quillElement;
    }

    // Check if Quill editor is a child
    const childQuill = element.querySelector('.ql-editor');
    if (childQuill) {
      const quillElement = childQuill as HTMLElement;
      this._quillEditorCache.set(element, quillElement);
      return quillElement;
    }

    // Last resort: find any Quill editor on the page (throttled)
    const now = Date.now();
    if (now - this._lastPageWideSearchTime > GeminiStrategy.PAGE_WIDE_SEARCH_THROTTLE_MS) {
      this._lastPageWideSearchTime = now;

      const anyQuill = document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]');
      if (anyQuill) {
        const quillElement = anyQuill as HTMLElement;
        this._quillEditorCache.set(element, quillElement);
        this._debug('Quill editor found via page-wide search (throttled)', {
          throttleMs: GeminiStrategy.PAGE_WIDE_SEARCH_THROTTLE_MS
        });
        return quillElement;
      }
    } else {
      this._debug('Page-wide Quill search throttled', {
        timeSinceLastSearch: now - this._lastPageWideSearchTime,
        throttleMs: GeminiStrategy.PAGE_WIDE_SEARCH_THROTTLE_MS
      });
    }

    // Cache negative result to avoid repeated searches for same element
    this._quillEditorCache.set(element, null);

    // Return original element as final fallback
    return element;
  }

  /**
   * Attempts insertion using Quill.js API
   * @param element - Quill editor element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   * @private
   */
  private _tryQuillInsertion(element: HTMLElement, content: string): InsertionResult {
    try {
      const quillElement = element as QuillElement;

      // Try to find Quill instance on the element
      const quill = quillElement.__quill || quillElement.quill;

      if (quill && typeof quill.setText === 'function') {
        // Use Quill API to set text
        quill.setText(content);

        // Trigger events for Angular change detection
        this._dispatchAngularEvents(element, content, 'basic');

        this._debug('Quill API insertion successful');
        return { success: true, method: 'gemini-quill-api' };
      }

      // Try alternative Quill instance locations
      // Note: Quill might be accessible via window, but we don't need to access it
      if (element.classList.contains('ql-editor')) {
        this._debug('Quill editor found but instance not accessible on element');
      }

    } catch (error) {
      this._warn('Quill API insertion failed', error instanceof Error ? error : { error: String(error) });
    }

    return { success: false };
  }

  /**
   * Attempts insertion using execCommand
   * @param element - Quill editor element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   * @private
   */
  private async _tryExecCommand(element: HTMLElement, content: string): Promise<InsertionResult> {
    if (element.contentEditable === 'true') {
      try {
        element.focus();
        element.click();

        // Wait for focus to settle
        await new Promise(resolve => setTimeout(resolve, GEMINI_FOCUS_DELAY_MS));

        // Select all existing content
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        // Insert new content using execCommand
        const inserted = document.execCommand('insertText', false, content);

        if (inserted) {
          // Trigger Angular-compatible events
          this._dispatchAngularEvents(element, content, 'basic');

          this._debug('execCommand insertion successful');
          return { success: true, method: 'gemini-execCommand' };
        }
      } catch (error) {
        this._warn('execCommand failed', error instanceof Error ? error : { error: String(error) });
      }
    }

    return { success: false };
  }

  /**
   * Dispatches Angular-compatible events after content insertion
   * This triggers zone.js change detection for proper UI updates
   * @param element - Target element
   * @param content - Inserted content
   * @param eventType - Type of insertion ('basic' | 'comprehensive')
   * @private
   */
  private _dispatchAngularEvents(
    element: HTMLElement,
    content: string,
    eventType: 'basic' | 'comprehensive' = 'basic'
  ): void {
    // Always dispatch input event with proper InputEvent interface
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content
    });
    element.dispatchEvent(inputEvent);

    // Always dispatch change event
    element.dispatchEvent(new Event('change', { bubbles: true }));

    if (eventType === 'comprehensive') {
      // Additional events for DOM manipulation fallback
      element.dispatchEvent(new Event('blur-sm', { bubbles: true }));
      element.dispatchEvent(new Event('focus', { bubbles: true }));
    } else {
      // Quill-specific events
      element.dispatchEvent(new Event('text-change', { bubbles: true }));
      element.dispatchEvent(new Event('compositionend', { bubbles: true }));
    }
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
      // For contenteditable elements, use text nodes for security
      if (element.contentEditable === 'true') {
        element.focus();

        // Clear existing content safely
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }

        // Create a paragraph with text node (Quill structure)
        const paragraph = document.createElement('p');
        const textNode = document.createTextNode(content);
        paragraph.appendChild(textNode);
        element.appendChild(paragraph);

        // Dispatch comprehensive event set for Angular
        this._dispatchAngularEvents(element, content, 'comprehensive');

        this._debug('DOM manipulation successful');
        return { success: true, method: 'gemini-dom-manipulation' };
      }

      this._warn('Element is not contenteditable', {
        tagName: element.tagName,
        contentEditable: element.contentEditable
      });

    } catch (error) {
      this._error('All insertion methods failed', error as Error);
    }

    return {
      success: false,
      error: 'All insertion methods failed for Gemini'
    };
  }
}
