/**
 * Centralized selectors for E2E tests
 *
 * This module provides role-based and testid-based selectors following Playwright's
 * recommended locator priority:
 * 1. getByRole() - buttons, headings, links, etc.
 * 2. getByLabel() - form inputs with labels
 * 3. getByPlaceholder() - inputs with placeholder text
 * 4. getByText() - visible text content
 * 5. getByTestId() - only when above options don't work
 */

import type { Page } from '@playwright/test';

/**
 * Helper functions for creating role-based locators
 */
export const createSelectors = (page: Page) => ({
  /**
   * Get a category row by name using data-testid attribute
   */
  categoryRow: (name: string) =>
    page.getByTestId('category-row').filter({ has: page.getByText(name, { exact: true }) }).first(),

  /**
   * Get a prompt card by title using role-based locators
   * Filters articles that contain a heading with the specified title
   */
  promptCard: (title: string) =>
    page.getByTestId('prompt-card').filter({ has: page.getByRole('heading', { name: title }) }).first(),

  /**
   * Get all prompt cards
   */
  promptCards: () =>
    page.getByTestId('prompt-card'),

  /**
   * Get close button using data-testid attribute
   */
  closeButton: () =>
    page.getByTestId('close-modal').first(),

  /**
   * Get back button using data-testid attribute
   */
  backButton: () =>
    page.getByTestId('back-button').first(),

  /**
   * Get success message with fallback selectors
   */
  successMessage: (message: string) =>
    page.getByText(message).first(),

  /**
   * Get form field by label text
   */
  formField: (label: string) =>
    page.getByLabel(label),

  /**
   * Get button by exact text match
   */
  buttonExact: (text: string) =>
    page.getByRole('button', { name: text, exact: true }),

  /**
   * Get heading by text
   */
  heading: (text: string) =>
    page.getByRole('heading', { name: text }),

  /**
   * Get all elements matching a role
   */
  allByRole: (role: 'button' | 'heading' | 'textbox' | 'link' | 'article' | 'main' | 'navigation' | 'banner' | 'contentinfo' | 'region') =>
    page.getByRole(role),

  /**
   * Get the category name edit input by placeholder
   */
  categoryNameEditInput: () =>
    page.getByPlaceholder('Category name', { exact: true }),

  /**
   * Get the storage bar using data-testid
   */
  storageBar: () =>
    page.getByTestId('storage-bar'),

  /**
   * Get prompt titles in display order
   * Uses role-based locators to find headings within prompt cards
   */
  promptTitles: () =>
    page.getByTestId('prompt-card').getByRole('heading'),
});

/**
 * Type-safe selector helper
 */
export type SelectorHelper = ReturnType<typeof createSelectors>;
