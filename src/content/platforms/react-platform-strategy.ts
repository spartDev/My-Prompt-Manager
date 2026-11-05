/**
 * React Platform Strategy Base Class
 *
 * Abstract base class for platforms that use React-based input controls.
 * Handles React's custom value setter, event triggering, and the content type check.
 *
 * This class encapsulates common patterns for React-based platforms:
 * - Native value setter caching for performance
 * - A type check on content (the content itself is inserted exactly as given)
 * - React-compatible textarea insertion with proper event dispatch
 *
 * Derived classes should:
 * - Call initializeNativeValueSetter() in their constructor
 * - Use validateContent() to check content before insertion
 * - Use insertIntoReactTextarea() for textarea insertion
 */

import type { InsertionResult } from '../types/index';

import { PlatformStrategy } from './base-strategy';

/**
 * Extended HTMLTextAreaElement interface for React property setter
 * React attaches a _valueTracker to track internal state
 */
interface ReactTextAreaElement extends HTMLTextAreaElement {
  _valueTracker?: {
    setValue: (value: string) => void;
  };
}

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
   * Cached native value setter for performance optimization
   * Shared across all React-based strategy instances
   * Avoids repeated Object.getOwnPropertyDescriptor calls (~90% overhead reduction)
   */
  private static nativeValueSetter: ((this: HTMLTextAreaElement, value: string) => void) | null = null;

  /**
   * Type guard to validate a function is a valid HTMLTextAreaElement value setter
   * @param fn - The function to validate
   * @returns True if fn is a valid value setter function
   */
  private static isValueSetter(
    fn: unknown
  ): fn is (this: HTMLTextAreaElement, value: string) => void {
    return typeof fn === 'function';
  }

  /**
   * Initialize native value setter cache on first use
   * Should be called in the constructor of derived classes
   *
   * This caches the native HTMLTextAreaElement value setter to avoid
   * repeated property descriptor lookups (90% performance improvement).
   *
   * @protected
   */
  protected static initializeNativeValueSetter(): void {
    if (!ReactPlatformStrategy.nativeValueSetter) {
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      );

      // Store the setter - we call it with .call(element, value) to provide correct `this` context
      // Safe: We explicitly control `this` binding at call site using .call()
      if (descriptor?.set && ReactPlatformStrategy.isValueSetter(descriptor.set)) {
        ReactPlatformStrategy.nativeValueSetter = descriptor.set;
      } else {
        ReactPlatformStrategy.nativeValueSetter = null;
      }
    }
  }

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
   * Insert content into React-controlled textarea element
   *
   * This method handles React's custom value tracking by:
   * 1. Focusing the element
   * 2. Setting the value property
   * 3. Calling the native value setter (if available)
   * 4. Dispatching 'input' and 'change' events for React state sync
   *
   * The native setter is critical for React to detect the change,
   * as React uses property descriptors to intercept value changes.
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
    const reactElement = element as ReactTextAreaElement;

    // Focus the element first to ensure it's active
    reactElement.focus();

    // Set the value property directly
    reactElement.value = content;

    // Trigger React's native value setter for state synchronization
    // This is what makes React "see" the change
    if (ReactPlatformStrategy.nativeValueSetter) {
      ReactPlatformStrategy.nativeValueSetter.call(reactElement, content);
    }

    // Dispatch events that React expects for controlled components
    reactElement.dispatchEvent(new Event('input', { bubbles: true }));
    reactElement.dispatchEvent(new Event('change', { bubbles: true }));

    this._debug(`${platformName} insertion successful`);

    return Promise.resolve({
      success: true,
      method: methodName || `${platformName.toLowerCase().replace(/\s+/g, '')}-textarea`
    });
  }
}
