/**
 * React Platform Strategy Base Class
 *
 * Abstract base class for platforms that use React-based input controls.
 * Handles React's custom value setter, event triggering, and the content type check.
 *
 * This class encapsulates common patterns for React-based platforms:
 * - A type check on content (the content itself is inserted exactly as given)
 * - React-compatible textarea insertion, where the caret is, with proper event dispatch
 *
 * Derived classes should:
 * - Use validateContent() to check content before insertion
 * - Use insertIntoReactTextarea() for textarea insertion
 */

import type { InsertionResult } from '../types/index';

import { PlatformStrategy } from './base-strategy';

/**
 * Result of checking content before insertion
 */
type ValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Abstract base strategy for React-based platforms
 * Provides shared functionality for platforms like Copilot and M365 Copilot
 */
export abstract class ReactPlatformStrategy extends PlatformStrategy {
  /**
   * Check content before insertion
   *
   * Only checks that the content is a string. Content is Verbatim (see ADR-001): it is
   * never changed, trimmed or shortened on its way into the input, so there is no
   * modified copy to return; insert the content you were given.
   *
   * @param content - Content to check
   * @returns Whether the content may be inserted, with an error message when it may not
   * @protected
   */
  protected validateContent(content: unknown): ValidationResult {
    if (typeof content !== 'string') {
      this._warn('Invalid content type', new Error('Content must be a string'));
      return {
        valid: false,
        error: 'Invalid content type'
      };
    }

    return { valid: true };
  }

  /**
   * Insert content into a React-controlled textarea element, where its caret is and in place
   * of the text selected there (see insertIntoTextControl): the value goes through the native
   * setter, which is what makes React see the change, then 'input' and 'change' are dispatched.
   *
   * @param element - Textarea element to insert content into
   * @param content - Content to insert (inserted exactly as given)
   * @param platformName - Platform name for logging (e.g., 'Copilot React', 'M365 Copilot')
   * @param methodName - Optional custom method name for result (defaults to auto-generated from platformName)
   * @returns Promise resolving to insertion result
   * @protected
   */
  protected insertIntoReactTextarea(
    element: HTMLTextAreaElement,
    content: string,
    platformName: string,
    methodName?: string
  ): Promise<InsertionResult> {
    this.insertIntoTextControl(element, content);

    this._debug(`${platformName} insertion successful`);

    return Promise.resolve({
      success: true,
      method: methodName || `${platformName.toLowerCase().replace(/\s+/g, '')}-textarea`
    });
  }
}
