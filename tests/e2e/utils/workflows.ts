/**
 * Common workflow functions for E2E tests
 *
 * This module provides reusable workflow functions that encapsulate
 * common user interaction patterns across multiple test files.
 */

import type { Page, BrowserContext, Download } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { assertions } from './assertions';

export interface PromptData {
  title?: string;
  content: string;
  category?: string;
}

export interface CategoryData {
  name: string;
  color?: string;
}

/**
 * Prompt management workflows
 */
export const promptWorkflows = {
  /**
   * Complete workflow to create a new prompt
   */
  create: async (page: Page, promptData: PromptData): Promise<void> => {
    // Click add new prompt
    await page.getByRole('button', { name: 'Add new prompt' }).click();
    await assertions.navigation.promptFormCreate(page);

    // Fill form
    if (promptData.title) {
      await page.getByLabel('Title (optional)').fill(promptData.title);
    }
    await page.getByLabel('Content *').fill(promptData.content);
    if (promptData.category) {
      // Click the dropdown button to open it
      await page.getByLabel('Category').click();
      // Wait for the menu to appear
      await page.getByRole('menu', { name: 'Select category' }).waitFor();
      // Click the desired category option
      await page.getByRole('menuitem', { name: promptData.category }).click();
    }

    // Save and verify
    await page.getByRole('button', { name: 'Save Prompt' }).click();
    await assertions.prompts.createdSuccessfully(page);
  },

  /**
   * Complete workflow to edit an existing prompt
   */
  edit: async (page: Page, originalTitle: string, updates: Partial<PromptData>): Promise<void> => {

    // Open actions menu and click edit
    const promptCard = page.getByTestId('prompt-card').filter({ has: page.getByRole('heading', { name: originalTitle }) }).first();
    await promptCard.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await assertions.navigation.promptFormEdit(page);

    // Apply updates
    if (updates.title !== undefined) {
      const titleField = page.getByLabel('Title (optional)');
      await titleField.clear();
      await titleField.fill(updates.title);
    }
    if (updates.content !== undefined) {
      const contentField = page.getByLabel('Content *');
      await contentField.clear();
      await contentField.fill(updates.content);
    }
    if (updates.category) {
      // Click the dropdown button to open it
      await page.getByLabel('Category').click();
      // Wait for the menu to appear
      await page.getByRole('menu', { name: 'Select category' }).waitFor();
      // Click the desired category option
      await page.getByRole('menuitem', { name: updates.category }).click();
    }

    // Save and verify
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await assertions.prompts.updatedSuccessfully(page);
  },

  /**
   * Complete workflow to delete a prompt
   */
  delete: async (page: Page, promptTitle: string, confirm: boolean = true): Promise<void> => {

    // Open actions menu and click delete
    const promptCard = page.getByTestId('prompt-card').filter({ has: page.getByRole('heading', { name: promptTitle }) }).first();
    await promptCard.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Handle confirmation dialog
    await assertions.dialogs.confirmationVisible(page, 'Delete Prompt');

    if (confirm) {
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await assertions.prompts.deletedSuccessfully(page);
    } else {
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  },

  /**
   * Bulk edit multiple prompts to a new category
   */
  bulkEditCategory: async (page: Page, promptTitles: string[], newCategory: string): Promise<void> => {
    for (const title of promptTitles) {
      await promptWorkflows.edit(page, title, { category: newCategory });
    }
  },
};

/**
 * Category management workflows
 */
export const categoryWorkflows = {
  /**
   * Open category manager from library
   */
  openManager: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Manage categories' }).click();
    await assertions.navigation.categoryManagerOpen(page);
  },

  /**
   * Close category manager and return to library
   * CategoryManager uses a Back button, not a Close button
   */
  closeManager: async (page: Page): Promise<void> => {
    const backButton = page.getByTestId('back-button').first();
    await expect(backButton).toBeVisible();
    await backButton.click();
    await assertions.navigation.onLibraryPage(page);
  },

  /**
   * Complete workflow to create a new category
   */
  create: async (page: Page, categoryData: CategoryData): Promise<void> => {
    await categoryWorkflows.openManager(page);

    // Fill name and add
    await page.getByPlaceholder('Enter category name...').fill(categoryData.name);
    await page.getByRole('button', { name: 'Add' }).click();
    await assertions.categories.createdSuccessfully(page);

    // Verify input cleared
    await expect(page.getByPlaceholder('Enter category name...')).toHaveValue('');

    await categoryWorkflows.closeManager(page);
  },

  /**
   * Complete workflow to edit a category name
   */
  edit: async (page: Page, currentName: string, newName: string): Promise<void> => {
    await categoryWorkflows.openManager(page);
    const categoryRow = page.getByTestId('category-row').filter({ has: page.getByText(currentName, { exact: true }) }).first();

    // Hover and click edit
    await categoryRow.hover();
    await categoryRow.getByRole('button', { name: 'Edit category' }).click();

    // Edit name
    const editInput = page.getByPlaceholder('Category name', { exact: true });
    await editInput.clear();
    await editInput.fill(newName);
    await page.getByRole('button', { name: 'Save changes (Enter)' }).click();
    await assertions.categories.updatedSuccessfully(page);

    await categoryWorkflows.closeManager(page);
  },

  /**
   * Complete workflow to delete a category
   */
  delete: async (page: Page, categoryName: string, confirm: boolean = true): Promise<void> => {
    await categoryWorkflows.openManager(page);
    const categoryRow = page.getByTestId('category-row').filter({ has: page.getByText(categoryName, { exact: true }) }).first();

    // Hover and click delete
    await categoryRow.hover();
    await categoryRow.getByRole('button', { name: 'Delete category' }).click();

    // Handle confirmation
    await assertions.dialogs.confirmationVisible(page, 'Delete Category');

    if (confirm) {
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await assertions.categories.deletedSuccessfully(page);
    } else {
      await page.getByRole('button', { name: 'Cancel' }).click();
    }

    await categoryWorkflows.closeManager(page);
  },
};

/**
 * Search and filter workflows
 */
export const searchWorkflows = {
  /**
   * Search for prompts and verify results
   */
  searchAndVerify: async (page: Page, query: string, expectedCount: number): Promise<void> => {
    const searchInput = page.getByPlaceholder('Search your prompts...');
    await searchInput.fill(query);
    await page.waitForLoadState('domcontentloaded'); // Wait for search processing
    await assertions.prompts.count(page, expectedCount);
  },

  /**
   * Filter by category and verify results
   */
  filterByCategoryAndVerify: async (page: Page, category: string, expectedCount: number): Promise<void> => {
    // Click the filter button to open dropdown
    await page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Click the category option
    await page.getByRole('menuitem', { name: category }).click();
    await assertions.prompts.count(page, expectedCount);
  },

  /**
   * Clear all filters and search
   */
  clearAllFilters: async (page: Page): Promise<void> => {
    // Click the filter button to open dropdown
    await page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Click "All Categories" to clear
    await page.getByRole('menuitem', { name: 'All Categories' }).click();
    await page.getByPlaceholder('Search your prompts...').clear();
  },

  /**
   * Test search with no results
   */
  searchNoResults: async (page: Page, query: string): Promise<void> => {
    await searchWorkflows.searchAndVerify(page, query, 0);
    await assertions.prompts.emptyState(page);
  },
};

/**
 * Navigation workflows
 */
export const navigationWorkflows = {
  /**
   * Navigate to settings and verify
   */
  toSettings: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await assertions.navigation.onSettingsPage(page);
  },

  /**
   * Navigate to library and verify
   * Uses back button since views no longer have "Library" navigation button
   */
  toLibrary: async (page: Page): Promise<void> => {
    const backButton = page.getByTestId('back-button').first();
    await expect(backButton).toBeVisible();
    await backButton.click();
    await assertions.navigation.onLibraryPage(page);
  },

  /**
   * Open sidepanel for testing
   */
  openSidepanel: async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });
    await assertions.navigation.onLibraryPage(page);
    return page;
  },

  /**
   * Open popup for testing
   */
  openPopup: async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await assertions.navigation.onLibraryPage(page);
    return page;
  },
};

/**
 * Settings workflows
 */
export const settingsWorkflows = {
  /**
   * Export data and verify download
   */
  exportData: async (page: Page): Promise<Download> => {
    await navigationWorkflows.toSettings(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    // Verify download properties
    expect(download.suggestedFilename()).toContain('prompt-library-backup');
    expect(download.suggestedFilename()).toContain('.json');

    return download;
  },

  /**
   * Change theme setting
   */
  changeTheme: async (page: Page, theme: 'system' | 'light' | 'dark'): Promise<void> => {
    await navigationWorkflows.toSettings(page);
    await page.getByRole('radio', { name: theme }).click();
    // Verify theme is selected
    await expect(page.getByRole('radio', { name: theme })).toBeChecked();
  },

  /**
   * Change interface mode
   */
  changeInterfaceMode: async (page: Page, mode: 'popup' | 'sidepanel'): Promise<void> => {
    await navigationWorkflows.toSettings(page);
    await page.getByRole('radio', { name: mode }).click();
    await expect(page.getByRole('radio', { name: mode })).toBeChecked();
  },
};

/**
 * Complex user journey workflows
 */
export const userJourneyWorkflows = {
  /**
   * New user setup journey
   */
  newUserSetup: async (page: Page): Promise<void> => {
    // Verify empty state
    await assertions.prompts.emptyState(page);

    // Create first category
    await categoryWorkflows.create(page, { name: 'Getting Started' });

    // Create first prompt
    await promptWorkflows.create(page, {
      title: 'My First Prompt',
      content: 'This is my first prompt to get started',
      category: 'Getting Started'
    });

    // Verify prompt exists
    await assertions.prompts.exists(page, 'My First Prompt');
  },

  /**
   * Power user bulk operations journey
   */
  powerUserBulkOperations: async (page: Page, promptTitles: string[]): Promise<void> => {
    // Create Professional category
    await categoryWorkflows.create(page, { name: 'Professional' });

    // Bulk move prompts to Professional
    await promptWorkflows.bulkEditCategory(page, promptTitles, 'Professional');

    // Verify all prompts moved
    await searchWorkflows.filterByCategoryAndVerify(page, 'Professional', promptTitles.length);

    // Test search functionality
    await searchWorkflows.searchAndVerify(page, 'review', 3);
  },

  /**
   * Category reorganization journey
   */
  categoryReorganization: async (page: Page): Promise<void> => {
    // Rename Work to Professional
    await categoryWorkflows.edit(page, 'Work', 'Professional');

    // Delete empty Marketing category
    await categoryWorkflows.delete(page, 'Marketing');

    // Note: Categories are now verified within the individual workflows
    // The edit and delete workflows already include verification
  },
};

/**
 * Analytics workflows
 */
export const analyticsWorkflows = {
  /**
   * Navigate to the Analytics tab
   */
  navigateToAnalyticsTab: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Analytics' }).click();
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  },

  /**
   * Navigate to the full analytics dashboard from the Analytics tab
   * Note: The dashboard opens in a new tab, so we need to wait for it and switch context
   */
  navigateToFullDashboard: async (page: Page): Promise<Page> => {
    const context = page.context();

    // Wait for the new page to open when button is clicked
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'View full analytics dashboard' }).click()
    ]);

    // Wait for the page to navigate to the analytics URL
    // In CI, the new tab may initially be about:blank before navigating
    await newPage.waitForURL(/analytics\.html/, { timeout: 30000 });

    // Wait for the page to fully load (including all resources)
    await newPage.waitForLoadState('load');

    // Wait for React to render the dashboard component
    // CI environments are slower, so we use a longer timeout
    await expect(newPage.getByRole('heading', { name: 'Analytics Dashboard' })).toBeVisible({ timeout: 30000 });

    return newPage;
  },

  /**
   * Clear usage history and confirm the action
   */
  clearHistory: async (page: Page): Promise<void> => {
    // Click the clear history button
    await page.getByRole('button', { name: 'Clear history' }).click();
    // Wait for confirmation modal
    await expect(page.getByRole('heading', { name: 'Clear Usage History?' })).toBeVisible();
    // Confirm clearing
    await page.getByRole('button', { name: 'Clear History' }).click();
    // Wait for modal to close
    await expect(page.getByRole('heading', { name: 'Clear Usage History?' })).toBeHidden();
  },

  /**
   * Cancel clearing usage history
   */
  cancelClearHistory: async (page: Page): Promise<void> => {
    // Click the clear history button
    await page.getByRole('button', { name: 'Clear history' }).click();
    // Wait for confirmation modal
    await expect(page.getByRole('heading', { name: 'Clear Usage History?' })).toBeVisible();
    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    // Wait for modal to close
    await expect(page.getByRole('heading', { name: 'Clear Usage History?' })).toBeHidden();
  },

  /**
   * Switch between prompt tabs in the full dashboard
   */
  switchTab: async (page: Page, tabName: 'Most Used' | 'Recently Used' | 'Forgotten'): Promise<void> => {
    await page.getByRole('tab', { name: tabName }).click();
    await expect(page.getByRole('tab', { name: tabName })).toHaveAttribute('aria-selected', 'true');
  },

  /**
   * Verify the analytics summary section is visible with expected cards
   */
  verifyAnalyticsSummary: async (page: Page): Promise<void> => {
    const summarySection = page.getByRole('region', { name: 'Usage summary' });
    await expect(summarySection).toBeVisible();
    // Verify the four summary cards are present
    await expect(summarySection.getByText('Total Uses')).toBeVisible();
    await expect(summarySection.getByText('Top Platform')).toBeVisible();
    await expect(summarySection.getByText('Peak Day')).toBeVisible();
    await expect(summarySection.getByText('Top Category')).toBeVisible();
  },

  /**
   * Open analytics dashboard (combines navigation to tab and then to full dashboard)
   * Returns the new page where the dashboard is opened
   */
  openAnalyticsDashboard: async (page: Page): Promise<Page> => {
    await analyticsWorkflows.navigateToAnalyticsTab(page);
    return await analyticsWorkflows.navigateToFullDashboard(page);
  },
};

/**
 * All workflows combined for easy import
 */
export const workflows = {
  prompts: promptWorkflows,
  categories: categoryWorkflows,
  search: searchWorkflows,
  navigation: navigationWorkflows,
  settings: settingsWorkflows,
  userJourneys: userJourneyWorkflows,
  analytics: analyticsWorkflows,
};