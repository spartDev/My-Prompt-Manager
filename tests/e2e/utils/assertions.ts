/**
 * Common assertion patterns for E2E tests
 *
 * This module provides reusable assertion functions that encapsulate
 * common expectations used across multiple test files.
 */

import type { Page, Locator } from '@playwright/test';

import type { Prompt, Category } from '../../../src/types';
import { expect } from '../fixtures/extension';

/**
 * Success message assertions
 */
export const expectSuccessMessage = async (page: Page, message: string): Promise<void> => {
  await expect(page.getByText(message).first()).toBeVisible();
};

/**
 * Error message assertions
 */
export const expectErrorMessage = async (page: Page, message: string): Promise<void> => {
  await expect(page.getByText(message)).toBeVisible();
};

/**
 * Prompt-related assertions
 */
export const promptAssertions = {
  /**
   * Expect a prompt to exist in the UI
   */
  exists: async (page: Page, title: string): Promise<void> => {
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
  },

  /**
   * Expect a prompt to not exist in the UI
   */
  notExists: async (page: Page, title: string): Promise<void> => {
    await expect(page.getByRole('heading', { name: title })).toBeHidden();
  },

  /**
   * Expect a specific number of prompts to be visible
   */
  count: async (page: Page, count: number): Promise<void> => {
    await expect(page.getByTestId('prompt-card')).toHaveCount(count);
  },

  /**
   * Expect prompt creation success
   */
  createdSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Prompt created successfully');
  },

  /**
   * Expect prompt update success
   */
  updatedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Prompt updated successfully');
  },

  /**
   * Expect prompt deletion success
   */
  deletedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Prompt deleted successfully');
  },

  /**
   * Expect empty state when no prompts match
   */
  emptyState: async (page: Page): Promise<void> => {
    await expect(page.getByText('No matches found')).toBeVisible();
  },
};

/**
 * Category-related assertions
 */
export const categoryAssertions = {
  /**
   * Expect a category to exist
   */
  exists: async (page: Page, name: string): Promise<void> => {
    // Check that category exists in the category filter dropdown
    // Open the filter dropdown
    await page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Check if the category menuitem exists
    await expect(page.getByRole('menuitem', { name })).toBeAttached();
    // Close the menu
    await page.keyboard.press('Escape');
  },

  /**
   * Expect a category to not exist
   */
  notExists: async (page: Page, name: string): Promise<void> => {
    // Open the filter dropdown
    await page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Check that the category menuitem does not exist
    await expect(page.getByRole('menuitem', { name })).not.toBeAttached();
    // Close the menu
    await page.keyboard.press('Escape');
  },

  /**
   * Expect a specific category count
   */
  count: async (page: Page, count: number): Promise<void> => {
    const text = count === 1 ? '1 category' : `${String(count)} categories`;
    await expect(page.getByText(text)).toBeVisible();
  },

  /**
   * Expect category creation success
   */
  createdSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Category created successfully');
  },

  /**
   * Expect category update success
   */
  updatedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Category updated successfully');
  },

  /**
   * Expect category deletion success
   */
  deletedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Category deleted successfully');
  },

  /**
   * Expect category already exists validation error
   */
  duplicateError: async (page: Page): Promise<void> => {
    await expectErrorMessage(page, '⚠️ Category already exists');
  },
};

/**
 * Form validation assertions
 */
export const formAssertions = {
  /**
   * Expect required field validation
   */
  requiredField: async (page: Page, fieldName: string): Promise<void> => {
    await expectErrorMessage(page, `${fieldName} is required`);
  },

  /**
   * Expect form button to be enabled
   */
  buttonEnabled: async (button: Locator): Promise<void> => {
    await expect(button).toBeEnabled();
  },

  /**
   * Expect form button to be disabled
   */
  buttonDisabled: async (button: Locator): Promise<void> => {
    await expect(button).toBeDisabled();
  },

  /**
   * Expect form field to have specific value
   */
  fieldValue: async (field: Locator, value: string): Promise<void> => {
    await expect(field).toHaveValue(value);
  },

  /**
   * Expect form field to be empty
   */
  fieldEmpty: async (field: Locator): Promise<void> => {
    await expect(field).toHaveValue('');
  },
};

/**
 * Navigation assertions
 */
export const navigationAssertions = {
  /**
   * Expect to be on the library page
   */
  onLibraryPage: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  },

  /**
   * Expect to be on the settings page
   */
  onSettingsPage: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  },

  /**
   * Expect category manager to be open
   */
  categoryManagerOpen: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
  },

  /**
   * Expect prompt form to be in create mode
   */
  promptFormCreate: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Add New Prompt' })).toBeVisible();
  },

  /**
   * Expect prompt form to be in edit mode
   */
  promptFormEdit: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();
  },
};

/**
 * Storage-related assertions
 */
export const storageAssertions = {
  /**
   * Expect storage to contain a specific prompt
   */
  containsPrompt: (prompts: Prompt[], expectedPrompt: Partial<Prompt>): boolean => {
    const found = prompts.some(prompt =>
      Object.entries(expectedPrompt).every(([key, value]) =>
        prompt[key as keyof Prompt] === value
      )
    );
    return found;
  },

  /**
   * Expect storage to contain a specific category
   */
  containsCategory: (categories: Category[], expectedCategory: Partial<Category>): boolean => {
    const found = categories.some(category =>
      Object.entries(expectedCategory).every(([key, value]) =>
        category[key as keyof Category] === value
      )
    );
    return found;
  },

  /**
   * Expect specific number of items in storage
   */
  promptCount: (prompts: Prompt[], count: number): boolean => {
    return prompts.length === count;
  },

  /**
   * Expect specific number of categories in storage
   */
  categoryCount: (categories: Category[], count: number): boolean => {
    return categories.length === count;
  },

  /**
   * Expect prompt to not exist in storage
   */
  promptNotExists: (prompts: Prompt[], title: string): boolean => {
    const promptExists = prompts.some(p => p.title === title);
    return !promptExists;
  },

  /**
   * Expect category to not exist in storage
   */
  categoryNotExists: (categories: Category[], name: string): boolean => {
    const categoryExists = categories.some(c => c.name === name);
    return !categoryExists;
  },
};

/**
 * Content script assertions
 * Note: These assertions use CSS class selectors because they target elements
 * injected by our content script into third-party websites (Claude, ChatGPT, etc.).
 * Role-based selectors are not applicable for these custom injected components.
 */
export const contentScriptAssertions = {
  /**
   * Expect toolbar to be injected (content script component)
   */
  toolbarInjected: async (page: Page): Promise<void> => {
    await expect(page.locator('.prompt-library-integrated-icon')).toBeVisible();
  },

  /**
   * Expect prompt selector to be visible (content script component)
   */
  selectorVisible: async (page: Page): Promise<void> => {
    await expect(page.locator('.prompt-library-selector')).toBeVisible();
  },

  /**
   * Expect prompt selector to be hidden (content script component)
   */
  selectorHidden: async (page: Page): Promise<void> => {
    await expect(page.locator('.prompt-library-selector')).toBeHidden();
  },

  /**
   * Expect text to be inserted into editor (third-party site element)
   */
  textInserted: async (page: Page, content: string, editorSelector: string): Promise<void> => {
    await expect(page.locator(editorSelector)).toContainText(content);
  },
};

/**
 * Dialog assertions
 */
export const dialogAssertions = {
  /**
   * Expect confirmation dialog to be visible
   */
  confirmationVisible: async (page: Page, title: string): Promise<void> => {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  },

  /**
   * Expect warning message in dialog
   */
  warningMessage: async (page: Page, message: string): Promise<void> => {
    await expect(page.getByText(message)).toBeVisible();
  },
};

/**
 * Analytics-related assertions
 */
export const analyticsAssertions = {
  /**
   * Expect analytics tab to be loaded (AnalyticsTab component)
   */
  tabLoaded: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  },

  /**
   * Expect full analytics dashboard to be loaded (AnalyticsDashboard component)
   */
  dashboardLoaded: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Analytics Dashboard' })).toBeVisible();
  },

  /**
   * Expect empty state when no usage data exists
   */
  emptyState: async (page: Page): Promise<void> => {
    await expect(page.getByText('No usage data yet')).toBeVisible();
  },

  /**
   * Expect total uses summary card to show specific value
   */
  totalUses: async (page: Page, count: number): Promise<void> => {
    const summarySection = page.locator('section[aria-label="Usage summary"]');
    await expect(summarySection.getByText(String(count))).toBeVisible();
  },

  /**
   * Expect top platform summary card to show specific platform name
   */
  topPlatform: async (page: Page, platformName: string): Promise<void> => {
    const summarySection = page.locator('section[aria-label="Usage summary"]');
    await expect(summarySection.getByText(platformName)).toBeVisible();
  },

  /**
   * Expect peak day summary card to show specific day
   */
  peakDay: async (page: Page, day: string): Promise<void> => {
    const summarySection = page.locator('section[aria-label="Usage summary"]');
    await expect(summarySection.getByText(day)).toBeVisible();
  },

  /**
   * Expect top category summary card to show specific category name
   */
  topCategory: async (page: Page, categoryName: string): Promise<void> => {
    const summarySection = page.locator('section[aria-label="Usage summary"]');
    await expect(summarySection.getByText(categoryName)).toBeVisible();
  },

  /**
   * Expect a prompt to appear in the top prompts list
   */
  promptInTopList: async (page: Page, promptTitle: string): Promise<void> => {
    const topPromptsSection = page.locator('section[aria-label="Top prompts"]');
    await expect(topPromptsSection.getByText(promptTitle)).toBeVisible();
  },

  /**
   * Expect specific number of prompts in the top prompts list
   */
  topPromptsCount: async (page: Page, count: number): Promise<void> => {
    const topPromptsSection = page.locator('section[aria-label="Top prompts"]');
    await expect(topPromptsSection.locator('li')).toHaveCount(count);
  },

  /**
   * Expect trophy icons to be visible for top 3 prompts
   */
  trophyIconsVisible: async (page: Page): Promise<void> => {
    // Trophy icons are SVGs with the sparkle/trophy path, rendered for first 3 items
    const topPromptsSection = page.locator('section[aria-label="Top prompts"]');
    const trophyIcons = topPromptsSection.locator('svg[aria-hidden="true"]');
    await expect(trophyIcons.first()).toBeVisible();
  },

  /**
   * Expect clear history confirmation modal to be visible
   */
  clearHistoryModalVisible: async (page: Page): Promise<void> => {
    await expect(page.getByRole('dialog', { name: /Clear Usage History/i })).toBeVisible();
  },

  /**
   * Expect clear history confirmation modal to be hidden
   */
  clearHistoryModalHidden: async (page: Page): Promise<void> => {
    await expect(page.getByRole('dialog', { name: /Clear Usage History/i })).toBeHidden();
  },

  /**
   * Expect "View Full Dashboard" expand button to be visible
   */
  expandButtonVisible: async (page: Page): Promise<void> => {
    await expect(page.getByRole('button', { name: 'View full analytics dashboard' })).toBeVisible();
  },

  /**
   * Expect "View Full Dashboard" expand button to be hidden
   */
  expandButtonHidden: async (page: Page): Promise<void> => {
    await expect(page.getByRole('button', { name: 'View full analytics dashboard' })).toBeHidden();
  },

  /**
   * Expect a specific tab to be selected in the dashboard prompt tables
   */
  tabSelected: async (page: Page, tabName: 'Most Used' | 'Recently Used' | 'Forgotten'): Promise<void> => {
    await expect(page.getByRole('tab', { name: tabName, selected: true })).toBeVisible();
  },

  /**
   * Expect a chart section to be visible (Usage Trend, Platforms, etc.)
   */
  chartVisible: async (page: Page, chartLabel: string): Promise<void> => {
    await expect(page.locator(`section[aria-label="${chartLabel}"]`)).toBeVisible();
  },
};

/**
 * Comprehensive assertion helper that combines all assertion types
 */
export const assertions = {
  success: expectSuccessMessage,
  error: expectErrorMessage,
  prompts: promptAssertions,
  categories: categoryAssertions,
  forms: formAssertions,
  navigation: navigationAssertions,
  storage: storageAssertions,
  contentScript: contentScriptAssertions,
  dialogs: dialogAssertions,
  analytics: analyticsAssertions,
};