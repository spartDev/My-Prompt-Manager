/**
 * E2E Test Utilities Index
 *
 * This module provides a central export point for all E2E testing utilities,
 * making it easy to import and use across test files.
 */

// Page Object Models
export * from '../pages';

// Core utilities
export * from './selectors';
export * from './assertions';
export * from './workflows';
export * from './navigation';

// Storage and data management
export * from './storage';
export * from './enhanced-storage';

// Test data fixtures
export * from '../fixtures/test-data';

// Re-export commonly used types
export type { Page, Locator, BrowserContext } from '@playwright/test';
export type { ExtensionStorage } from '../fixtures/extension';
export type { Prompt, Category, Settings } from '../../../src/types';

/**
 * Convenience object that groups related utilities together
 */
export const E2EUtils = {
  // Page Object Models
  Pages: {
    LibraryPage: () => import('../pages/LibraryPage').then(m => m.LibraryPage),
    CategoryManagerPage: () => import('../pages/CategoryManagerPage').then(m => m.CategoryManagerPage),
    PromptFormPage: () => import('../pages/PromptFormPage').then(m => m.PromptFormPage),
    SettingsPage: () => import('../pages/SettingsPage').then(m => m.SettingsPage),
    ConfirmationDialog: () => import('../pages/ConfirmationDialog').then(m => m.ConfirmationDialog),
  },

  // Utilities
  Selectors: () => import('./selectors').then(m => ({ SELECTORS: m.SELECTORS, createSelectors: m.createSelectors })),
  Assertions: () => import('./assertions').then(m => m.assertions),
  Workflows: () => import('./workflows').then(m => m.workflows),
  Navigation: () => import('./navigation').then(m => m.navigation),

  // Data management
  Storage: () => import('./enhanced-storage').then(m => m.scenarioFactory),
  TestData: () => import('../fixtures/test-data').then(m => ({
    SCENARIO_FIXTURES: m.SCENARIO_FIXTURES,
    PROMPT_FIXTURES: m.PROMPT_FIXTURES,
    CATEGORY_FIXTURES: m.CATEGORY_FIXTURES,
    testDataHelpers: m.testDataHelpers,
  })),
};