/**
 * Microsoft Copilot Platform Strategy module
 *
 * Strategy for handling Microsoft Copilot's textarea inputs
 * Uses React-specific event triggering for proper state updates
 */

import { getPlatformById } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';

import { MAX_CONTENT_LENGTHS } from './constants';
import { ReactPlatformStrategy } from './react-platform-strategy';

export class CopilotStrategy extends ReactPlatformStrategy {
  constructor(hostname?: string) {
    const platform = getPlatformById('copilot');

    super('copilot', 80, {
      selectors: platform?.selectors || [
        'textarea[data-testid="composer-input"]',
        'textarea#userInput',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Copilot"]'
      ],
      buttonContainerSelector: platform?.buttonContainerSelector,
      priority: 80
    }, hostname);

    // Initialize React native value setter cache
    ReactPlatformStrategy.initializeNativeValueSetter();
  }

  /**
   * Determines if this strategy can handle the element
   * Only handles textarea elements on copilot.microsoft.com
   */
  canHandle(element: HTMLElement): boolean {
    return this.hostname === getPlatformById('copilot')?.hostname && element.tagName === 'TEXTAREA';
  }

  /**
   * Inserts content using React-compatible methods
   * Uses native property setter to trigger React state updates
   */
  async insert(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      // Validate and sanitize content
      const validation = this.validateAndSanitize(content, MAX_CONTENT_LENGTHS.COPILOT);
      if (!validation.valid) {
        return await Promise.resolve({
          success: false,
          error: validation.error
        });
      }

      // Validation ensures sanitized is defined (allow empty strings)
      if (typeof validation.sanitized !== 'string') {
        return await Promise.resolve({
          success: false,
          error: 'Content sanitization failed'
        });
      }

      // Insert using shared React textarea method
      // We use "Copilot React" for success logs but catch errors for custom error logging
      return await this.insertIntoReactTextarea(
        element as HTMLTextAreaElement,
        validation.sanitized,
        'Copilot React',
        'copilot-react'
      );
    } catch (error) {
      // Custom error logging to match expected test format
      this._warn('React insertion failed', error as Error);
      return await Promise.resolve({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Gets selectors for finding Copilot input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Copilot-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    const { element, cleanup } = uiFactory.createCopilotIcon();
    // Store cleanup function on element for later retrieval by injector
    (element as HTMLElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return element;
  }
}
