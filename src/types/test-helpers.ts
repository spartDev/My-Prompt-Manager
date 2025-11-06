/**
 * Test Helper Types
 *
 * This file provides type-safe utilities for testing without relying on `as any` assertions.
 * It centralizes mock types, Chrome API types, and global augmentations used across test files.
 */

import type { Mock } from 'vitest';

import type { StorageManagerMock, PromptManagerMock } from '../test/setup';

/**
 * Chrome API Mock Types
 *
 * Provides properly typed interfaces for mocking Chrome extension APIs in tests.
 */

/**
 * Type for chrome.tabs.query mock function
 * Handles both callback and promise-based usage patterns
 */
export type ChromeTabsQueryMock = Mock<
  [queryInfo: chrome.tabs.QueryInfo, callback?: (tabs: chrome.tabs.Tab[]) => void],
  Promise<chrome.tabs.Tab[]>
>;

/**
 * Type for chrome.tabs.sendMessage mock function
 */
export type ChromeTabsSendMessageMock = Mock<
  [tabId: number, message: unknown, options?: chrome.tabs.MessageSendOptions],
  Promise<unknown>
>;

/**
 * Type for window.matchMedia mock function
 */
export type WindowMatchMediaMock = Mock<
  [query: string],
  MediaQueryList
>;

/**
 * Global Test Mocks
 *
 * Type-safe augmentation of globalThis for test utilities.
 */

/**
 * Extended globalThis type with test mock utilities
 */
export type GlobalWithMocks = typeof globalThis & {
  chrome: typeof chrome;
  __STORAGE_MANAGER_MOCK__?: StorageManagerMock;
  __PROMPT_MANAGER_MOCK__?: PromptManagerMock;
  __CHROME_STORAGE_CHANGE_LISTENERS__?: Array<
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
  >;
  __triggerChromeStorageChange__?: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName?: string
  ) => void;
};

/**
 * Type guard to check if globalThis has mock utilities
 */
export function isGlobalWithMocks(global: typeof globalThis): global is GlobalWithMocks {
  return '__triggerChromeStorageChange__' in global;
}

/**
 * Storage Manager Mock Type Extensions
 *
 * Provides type-safe access to mocked StorageManager methods.
 */

/**
 * Type for updateSettings mock function
 */
export type UpdateSettingsMock = Mock<
  [updates: Partial<chrome.storage.StorageChange['newValue']>],
  Promise<chrome.storage.StorageChange['newValue']>
>;

/**
 * Helper to get properly typed chrome mock from globalThis
 */
export function getChromeMock(): typeof chrome {
  return (globalThis as GlobalWithMocks).chrome;
}

/**
 * Helper to get properly typed trigger function from globalThis
 */
export function getStorageChangeTrigger(): (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName?: string
) => void {
  const trigger = (globalThis as GlobalWithMocks).__triggerChromeStorageChange__;
  if (!trigger) {
    throw new Error('Storage change trigger not initialized. Ensure setup.ts has been executed.');
  }
  return trigger;
}

/**
 * Type for MediaQueryList mock used in window.matchMedia tests
 */
export interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof import('vitest').vi.fn>;
  removeEventListener: ReturnType<typeof import('vitest').vi.fn>;
}

/**
 * Type guard for MediaQueryList
 */
export function isMediaQueryList(obj: unknown): obj is MediaQueryList {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'matches' in obj &&
    'media' in obj &&
    'addEventListener' in obj
  );
}
