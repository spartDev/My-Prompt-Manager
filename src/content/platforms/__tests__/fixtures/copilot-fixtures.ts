/**
 * Test fixtures and helpers for Copilot platform tests
 *
 * This module provides reusable test utilities to eliminate duplication
 * in Copilot strategy tests and establish patterns for other platform tests.
 */

import { vi } from 'vitest';

import type { UIElementFactory } from '../../../ui/element-factory';

// Import and re-export shared utilities
import {
  cleanupElement,
  createMockUIFactory,
  setMockHostname,
  setupDispatchEventMock,
  setupNativeValueSetterMock,
  type MockLocation,
  type NativeValueSetterConfig
} from './shared-fixtures';

export {
  cleanupElement,
  createMockUIFactory,
  setMockHostname,
  setupDispatchEventMock,
  setupNativeValueSetterMock,
  type MockLocation,
  type NativeValueSetterConfig
};

/**
 * Type for Copilot textarea variants
 */
export type CopilotTextareaType = 'primary' | 'userInput' | 'generic';

/**
 * Configuration for creating mock textareas
 */
export interface TextareaConfig {
  /**
   * Type of textarea to create (determines which attributes are set)
   */
  type?: CopilotTextareaType;
  /**
   * Custom attributes to add to the textarea
   */
  attributes?: Record<string, string>;
  /**
   * Whether to auto-append to document.body
   */
  autoAppend?: boolean;
}

/**
 * Creates a mock textarea element for Copilot tests
 *
 * @param type - Type of textarea: 'primary', 'userInput', or 'generic'
 * @param autoAppend - Whether to automatically append to document.body
 * @returns A configured HTMLTextAreaElement with mocked focus method
 *
 * @example
 * ```typescript
 * // Create primary textarea
 * const textarea = createCopilotTextarea('primary');
 *
 * // Create with auto-append
 * const textarea = createCopilotTextarea('userInput', true);
 * ```
 */
export function createCopilotTextarea(
  type: CopilotTextareaType = 'primary',
  autoAppend = false
): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.focus = vi.fn();

  switch (type) {
    case 'primary':
      textarea.setAttribute('data-testid', 'composer-input');
      break;
    case 'userInput':
      textarea.id = 'userInput';
      break;
    case 'generic':
      textarea.setAttribute('placeholder', 'Message Copilot');
      break;
  }

  if (autoAppend) {
    document.body.appendChild(textarea);
  }

  return textarea;
}

/**
 * Creates a mock textarea with custom configuration
 *
 * @param config - Configuration object for textarea creation
 * @returns A configured HTMLTextAreaElement
 *
 * @example
 * ```typescript
 * const textarea = createCopilotTextareaWithConfig({
 *   type: 'primary',
 *   attributes: { 'aria-label': 'Chat input' },
 *   autoAppend: true
 * });
 * ```
 */
export function createCopilotTextareaWithConfig(
  config: TextareaConfig = {}
): HTMLTextAreaElement {
  const { type = 'primary', attributes = {}, autoAppend = false } = config;
  const textarea = createCopilotTextarea(type, false);

  // Apply custom attributes
  Object.entries(attributes).forEach(([key, value]) => {
    textarea.setAttribute(key, value);
  });

  if (autoAppend) {
    document.body.appendChild(textarea);
  }

  return textarea;
}

/**
 * Resets mock window.location.hostname to Copilot's default
 *
 * @returns The mock location object set to copilot.microsoft.com
 *
 * @example
 * ```typescript
 * // After changing hostname in a test
 * resetMockHostname();
 * ```
 */
export function resetMockHostname(): MockLocation {
  return setMockHostname('copilot.microsoft.com');
}

/**
 * Creates a textarea with React-specific value tracker
 *
 * @param type - Type of textarea to create
 * @returns Textarea with _valueTracker property
 *
 * @example
 * ```typescript
 * const reactTextarea = createReactTextarea('primary');
 * await strategy.insert(reactTextarea, 'content');
 * expect(reactTextarea._valueTracker.setValue).toHaveBeenCalled();
 * ```
 */
export function createReactTextarea(
  type: CopilotTextareaType = 'primary'
): HTMLTextAreaElement & { _valueTracker: { setValue: ReturnType<typeof vi.fn> } } {
  const textarea = createCopilotTextarea(type) as any;
  textarea._valueTracker = {
    setValue: vi.fn()
  };
  return textarea;
}

/**
 * Expected selectors for Copilot platform in priority order
 */
export const COPILOT_SELECTORS = [
  'textarea[data-testid="composer-input"]',
  'textarea#userInput',
  'textarea[placeholder*="Message"]',
  'textarea[placeholder*="Copilot"]'
] as const;

/**
 * Expected button container selector for Copilot platform
 */
export const COPILOT_BUTTON_CONTAINER_SELECTOR =
  '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child';

/**
 * Default hostname for Copilot platform
 */
export const COPILOT_HOSTNAME = 'copilot.microsoft.com';

/**
 * Strategy configuration constants
 */
export const COPILOT_CONFIG = {
  name: 'copilot',
  priority: 80,
  hostname: COPILOT_HOSTNAME,
  selectors: COPILOT_SELECTORS,
  buttonContainerSelector: COPILOT_BUTTON_CONTAINER_SELECTOR
} as const;
