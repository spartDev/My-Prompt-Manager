/**
 * Centralized selectors for E2E tests
 *
 * This module provides consistent selectors used across multiple test files
 * to reduce duplication and improve maintainability.
 */

import type { Page } from '@playwright/test';

export const SELECTORS = {
  // Main headings
  headings: {
    promptManager: 'heading[name="My Prompt Manager"]',
    manageCategories: 'heading[name="Manage Categories"]',
    settings: 'heading[name="Settings"]',
    addNewPrompt: 'heading[name="Add New Prompt"]',
    editPrompt: 'heading[name="Edit Prompt"]',
  },

  // Primary action buttons
  buttons: {
    addNewPrompt: 'button[name="Add new prompt"]',
    manageCategories: 'button[name="Manage categories"]',
    settings: 'button[name="Settings"]',
    library: 'button[name="Library"]',
    savePrompt: 'button[name="Save Prompt"]',
    saveChanges: 'button[name="Save Changes"]',
    cancel: 'button[name="Cancel"]',
    export: 'button[name="Export"]',
    import: 'button[name="Import"]',
  },

  // Form elements
  forms: {
    promptTitle: 'label[name="Title (optional)"]',
    promptContent: 'label[name="Content *"]',
    categoryDropdown: 'label[name="Category"]',
    categoryNameInput: 'input[placeholder="Enter category name..."]',
    searchInput: 'input[placeholder="Search your prompts..."]',
    addCategoryButton: 'button[name="Add"]',
  },

  // Category management
  categories: {
    editButton: 'button[name="Edit category"]',
    deleteButton: 'button[name="Delete category"]',
    categoryNameEdit: 'input[placeholder="Category name"]',
    saveButton: 'button[name="Save changes (Enter)"]',
  },

  // Content script elements
  contentScript: {
    toolbarIcon: '.prompt-library-integrated-icon',
    promptSelector: '.prompt-library-selector',
    promptItem: '.prompt-item',
    searchInput: '.search-input',
    closeButton: '.close-button',
  },

  // Platform-specific selectors
  platforms: {
    claude: {
      editor: '.ProseMirror[contenteditable="true"]',
      sendButton: '.send-button',
    },
    chatgpt: {
      textarea: '#prompt-textarea',
      sendButton: '#send-button',
    },
  },

  // Common UI patterns
  common: {
    closeButton: '[data-testid="close-modal"]',
    backButton: '[data-testid="back-button"]',
    promptCards: 'article',
    moreActionsButton: 'button[name="More actions"]',
    loadingSpinner: '[class*="spinner"], [class*="loading"]',
    emptyState: 'text="No matches found"',
    successMessage: '[class*="success"], [role="status"]',
    errorMessage: '[class*="error"], [role="alert"]',
  },

  // Confirmation dialogs
  dialogs: {
    deletePrompt: 'heading[name="Delete Prompt"]',
    deleteCategory: 'heading[name="Delete Category"]',
    confirmDelete: 'button[name="Delete"][exact]',
    cancelDelete: 'button[name="Cancel"]',
  },
} as const;

/**
 * Helper functions for creating locators with common patterns
 */
export const createSelectors = (page: Page) => ({
  /**
   * Get a category row by name with proper filtering
   */
  categoryRow: (name: string) =>
    page.locator('div.group')
      .filter({ hasText: name })
      .filter({ has: page.locator('div[style*="background-color"]') })
      .first(),

  /**
   * Get a prompt card by title
   */
  promptCard: (title: string) =>
    page.locator('article').filter({ hasText: title }).first(),

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
});

/**
 * Type-safe selector helper
 */
export type SelectorHelper = ReturnType<typeof createSelectors>;