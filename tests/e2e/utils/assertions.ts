/**
 * Common assertion patterns for E2E tests
 *
 * This module provides reusable assertion functions that encapsulate
 * common expectations used across multiple test files.
 */

import type { Locator, Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
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
    await expectSuccessMessage(page, 'Prompt created');
  },

  /**
   * Expect prompt update success
   */
  updatedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Prompt saved');
  },

  /**
   * Expect prompt deletion success
   */
  deletedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Prompt deleted');
  },

  /**
   * Expect empty state when no prompts match
   */
  emptyState: async (page: Page): Promise<void> => {
    await expect(page.getByRole('region', { name: 'No search results' })).toBeVisible();
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
    // A Category holding a Prompt has a Library filter pill
    await expect(page.getByRole('radiogroup', { name: 'Library filter' }).getByRole('radio', { name, exact: true })).toBeAttached();
  },

  /**
   * Expect a category to not exist
   */
  notExists: async (page: Page, name: string): Promise<void> => {
    await expect(page.getByRole('radiogroup', { name: 'Library filter' }).getByRole('radio', { name, exact: true })).not.toBeAttached();
  },

  /**
   * Expect a specific category count
   */
  count: async (page: Page, count: number): Promise<void> => {
    const text = count === 1 ? '1 category' : `${String(count)} categories`;
    // The count appears both in the Categories header subtitle and the list header
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  },

  /**
   * Expect category creation success
   */
  createdSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Category created');
  },

  /**
   * Expect category update success
   */
  updatedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Category saved');
  },

  /**
   * Expect category deletion success
   */
  deletedSuccessfully: async (page: Page): Promise<void> => {
    await expectSuccessMessage(page, 'Category deleted');
  },

  /**
   * Expect the Category sheet to have refused a name already taken: it stays open, the reason under
   * the name. Give the name to check the whole message
   */
  duplicateError: async (page: Page, name?: string): Promise<void> => {
    const refusal = page.getByRole('dialog', { name: /^(New|Edit) category$/ }).getByRole('alert');
    await expect(refusal).toContainText(name === undefined ? 'already exists' : `Category with name "${name}" already exists`);
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
    await expect(page.getByTestId('tab-library')).toHaveAttribute('aria-selected', 'true');
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
    await expect(page.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();
  },

  /**
   * Expect prompt form to be in create mode
   */
  promptFormCreate: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'New prompt', exact: true })).toBeVisible();
  },

  /**
   * Expect prompt form to be in edit mode
   */
  promptFormEdit: async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { name: 'Edit prompt', exact: true })).toBeVisible();
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
    await expect(page.locator('#mpm-prompt-selector').getByRole('dialog')).toBeVisible();
  },

  /**
   * Expect prompt selector to be hidden (content script component)
   */
  selectorHidden: async (page: Page): Promise<void> => {
    await expect(page.locator('#mpm-prompt-selector').getByRole('dialog')).toBeHidden();
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
    await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
    await expect(page).toHaveURL(/analytics\.html/);
  },

  /**
   * Expect the Analytics tab without usage: the page as ghosts, with no data in its tiles and no Most used
   */
  tabEmptyState: async (page: Page): Promise<void> => {
    await expect(page.getByTestId('stats-hero-subtitle')).toHaveText('Your week will draw itself here.');
    await expect(page.getByTestId('stats-empty').getByText('No data yet')).toHaveCount(2);
    await expect(page.getByRole('region', { name: 'Most used' })).toBeHidden();
  },

  /**
   * Expect the hero of the Analytics tab to count this many Prompts used
   */
  totalUses: async (page: Page, count: number): Promise<void> => {
    await expect(page.getByTestId('stats-total')).toHaveText(String(count));
  },

  /**
   * Expect the Top platform card to name this Platform
   */
  topPlatform: async (page: Page, platformName: string): Promise<void> => {
    const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Top platform', exact: true }) }).last();
    await expect(card.getByText(platformName, { exact: true })).toBeVisible();
  },

  /**
   * Expect the Top category card to name this Category
   */
  topCategory: async (page: Page, categoryName: string): Promise<void> => {
    const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Top category', exact: true }) }).last();
    await expect(card.getByText(categoryName, { exact: true })).toBeVisible();
  },

  /**
   * Expect the Most used card to list these Prompt titles, in this order
   */
  mostUsedTitles: async (page: Page, titles: string[]): Promise<void> => {
    await expect(page.getByTestId('most-used-row')).toHaveCount(titles.length);
    for (const [index, title] of titles.entries()) {
      await expect(page.getByTestId('most-used-row').nth(index)).toContainText(title);
    }
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