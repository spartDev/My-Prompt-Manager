/**
 * React Platform Strategy Base Class
 *
 * Abstract base class for platforms that use React-based input controls.
 * Handles React's custom value setter, event triggering, and content validation.
 *
 * This class encapsulates common patterns for React-based platforms:
 * - Native value setter caching for performance
 * - Content validation and sanitization
 * - React-compatible textarea insertion with proper event dispatch
 *
 * Derived classes should:
 * - Call initializeNativeValueSetter() in their constructor
 * - Use validateAndSanitize() to validate content before insertion
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
 * Result of content validation and sanitization
 */
interface ValidationResult {
  /** Whether the content is valid */
  valid: boolean;
  /** Sanitized content (only present if valid is true) */
  sanitized?: string;
  /** Error message (only present if valid is false) */
  error?: string;
}

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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      if (descriptor?.set && ReactPlatformStrategy.isValueSetter(descriptor.set)) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ReactPlatformStrategy.nativeValueSetter = descriptor.set;
      } else {
        ReactPlatformStrategy.nativeValueSetter = null;
      }
    }
  }

  /**
   * Validate and sanitize content before insertion
   *
   * Performs three validation checks:
   * 1. Type validation - ensures content is a string
   * 2. Length validation - enforces maximum character limit
   * 3. Sanitization - removes control characters (preserves newlines, tabs, CR)
   *
   * @param content - Content to validate
   * @param maxLength - Maximum allowed character length
   * @returns Validation result with sanitized content or error message
   * @protected
   */
  protected validateAndSanitize(
    content: string,
    maxLength: number
  ): ValidationResult {
    // Security: Validate input type
    if (typeof content !== 'string') {
      this._warn('Invalid content type', new Error('Content must be a string'));
      return {
        valid: false,
        error: 'Invalid content type'
      };
    }

    // Security: Enforce maximum length
    if (content.length > maxLength) {
      this._warn(`Content exceeds maximum length (${String(content.length)} > ${String(maxLength)})`);
      return {
        valid: false,
        error: `Content exceeds maximum length of ${String(maxLength)} characters`
      };
    }

    // Security: Sanitize control characters (preserve newlines \n, tabs \t, carriage returns \r)
    // Removes characters in ranges:
    // - \x00-\x08: NULL to BACKSPACE
    // - \x0B-\x0C: Vertical Tab, Form Feed
    // - \x0E-\x1F: Shift Out to Unit Separator
    // - \x7F-\x9F: Delete to Application Program Command
    // eslint-disable-next-line no-control-regex
    const sanitized = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    return {
      valid: true,
      sanitized
    };
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
   * @param content - Content to insert (should be pre-validated and sanitized)
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
