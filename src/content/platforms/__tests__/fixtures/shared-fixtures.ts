/**
 * Shared test fixtures and utilities for platform strategy tests
 *
 * This module provides reusable test utilities that are common across
 * all platform strategies (Copilot, M365 Copilot, etc.) to eliminate
 * duplication and ensure consistent test behavior.
 */

import { vi } from 'vitest';

import type { UIElementFactory } from '../../../ui/element-factory';

/**
 * Mock location object for hostname manipulation
 */
export interface MockLocation {
  hostname: string;
}

/**
 * Configuration for native value setter mock
 */
export interface NativeValueSetterConfig {
  /**
   * Whether to simulate the setter being unavailable
   */
  unavailable?: boolean;
}

/**
 * Removes an element from the DOM if it has a parent
 *
 * @param element - Element to remove from DOM
 *
 * @example
 * ```typescript
 * const textarea = document.createElement('textarea');
 * document.body.appendChild(textarea);
 * // ... test logic ...
 * cleanupElement(textarea);
 * ```
 */
export function cleanupElement(element: HTMLElement | null): void {
  if (element?.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Creates a mock UIElementFactory for platform tests
 *
 * @returns A mocked UIElementFactory with createCopilotIcon method
 *
 * @example
 * ```typescript
 * const mockUIFactory = createMockUIFactory();
 * const icon = strategy.createIcon(mockUIFactory);
 * expect(mockUIFactory.createCopilotIcon).toHaveBeenCalled();
 * ```
 */
export function createMockUIFactory(): UIElementFactory {
  return {
    createCopilotIcon: vi.fn().mockReturnValue({
      element: document.createElement('button'),
      cleanup: vi.fn()
    })
  } as any;
}

/**
 * Sets the mock window.location.hostname for testing
 *
 * @param hostname - Hostname to set
 * @returns The mock location object
 *
 * @example
 * ```typescript
 * setMockHostname('copilot.microsoft.com');
 * const strategy = new CopilotStrategy();
 * expect(strategy.canHandle(textarea)).toBe(true);
 * ```
 */
export function setMockHostname(hostname: string): MockLocation {
  const mockLocation: MockLocation = { hostname };
  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
    configurable: true
  });
  return mockLocation;
}

/**
 * Sets up mock for element dispatchEvent method
 *
 * @param element - Element to mock (can be any HTMLElement)
 * @returns The mocked dispatchEvent function
 *
 * @example
 * ```typescript
 * const textarea = document.createElement('textarea');
 * const dispatchSpy = setupDispatchEventMock(textarea);
 * await strategy.insert(textarea, 'content');
 * expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'input' }));
 * ```
 */
export function setupDispatchEventMock(element: HTMLElement): ReturnType<typeof vi.fn> {
  const dispatchSpy = vi.spyOn(element, 'dispatchEvent').mockImplementation(() => true);
  return dispatchSpy;
}

/**
 * Sets up mock for native value setter on HTMLTextAreaElement
 *
 * This mocks React's internal native value setter mechanism used for
 * textarea value manipulation. The mock intercepts property descriptor
 * access to provide a trackable setter function.
 *
 * @param config - Configuration for the mock
 * @returns Object containing the mock setter function and restore function
 *
 * @example
 * ```typescript
 * const { mockSetter, restore } = setupNativeValueSetterMock();
 * await strategy.insert(textarea, 'content');
 * expect(mockSetter).toHaveBeenCalledWith('content');
 * restore();
 * ```
 */
export function setupNativeValueSetterMock(
  config: NativeValueSetterConfig = {}
): {
  mockSetter: ReturnType<typeof vi.fn> | null;
  restore: () => void;
} {
  const { unavailable = false } = config;
  const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const mockSetter = unavailable ? null : vi.fn();

  Object.getOwnPropertyDescriptor = vi.fn((obj: any, prop: PropertyKey) => {
    if (obj === HTMLTextAreaElement.prototype && prop === 'value') {
      if (unavailable) {
        return undefined;
      }
      return {
        set: mockSetter,
        get: vi.fn(),
        enumerable: true,
        configurable: true
      };
    }
    return originalGetOwnPropertyDescriptor.call(Object, obj, prop);
  }) as any;

  const restore = () => {
    Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor;
  };

  return { mockSetter, restore };
}
