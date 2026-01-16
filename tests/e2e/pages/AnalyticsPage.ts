import type { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the Analytics views
 * Handles both AnalyticsTab (side panel) and AnalyticsDashboard (full page)
 *
 * Note: Following Page Object Model best practices, this class provides
 * locator-returning methods rather than assertion methods. Assertions
 * should be performed in test files.
 */
export class AnalyticsPage extends BasePage {
  /**
   * Navigate to the Analytics tab from the library view
   */
  async navigateToAnalyticsTab(): Promise<void> {
    await this.page.getByRole('button', { name: 'Analytics' }).click();
  }

  /**
   * Open the full dashboard view from the Analytics tab
   */
  async openFullDashboard(): Promise<void> {
    const expandButton = this.getExpandDashboardButton();
    await expandButton.click();
  }

  /**
   * Get a summary card by its label
   * @param label - The label of the summary card (e.g., "Total Uses", "Top Platform", "Peak Day", "Top Category")
   */
  getSummaryCard(label: string): Locator {
    return this.page.locator('section[aria-label="Usage summary"]')
      .locator(`text=${label}`)
      .locator('..');
  }

  /**
   * Get the top prompts section container
   */
  getTopPromptsSection(): Locator {
    return this.page.locator('section[aria-label="Top prompts"]');
  }

  /**
   * Get all top prompt list items
   */
  getTopPromptItems(): Locator {
    return this.getTopPromptsSection().locator('ul li');
  }

  /**
   * Get the "View Full Dashboard" floating action button
   */
  getExpandDashboardButton(): Locator {
    return this.page.getByRole('button', { name: 'View full analytics dashboard' });
  }

  /**
   * Get the "Clear history" button
   */
  getClearHistoryButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear history' });
  }

  /**
   * Get the clear history confirmation modal dialog
   */
  getClearHistoryModal(): Locator {
    return this.page.getByRole('dialog', { name: 'Clear Usage History?' });
  }

  /**
   * Get a tab by its name in the full dashboard prompt tables
   * @param tabName - The tab name ("Most Used", "Recently Used", or "Forgotten")
   */
  getTab(tabName: 'Most Used' | 'Recently Used' | 'Forgotten'): Locator {
    return this.page.getByRole('tab', { name: tabName });
  }

  /**
   * Switch to a specific tab in the full dashboard prompt tables
   * @param tabName - The tab name to switch to
   */
  async switchTab(tabName: 'Most Used' | 'Recently Used' | 'Forgotten'): Promise<void> {
    await this.getTab(tabName).click();
  }

  /**
   * Confirm clearing history in the confirmation modal
   */
  async confirmClearHistory(): Promise<void> {
    await this.getClearHistoryButton().click();
    const modal = this.getClearHistoryModal();
    await modal.waitFor({ state: 'visible' });
    await modal.getByRole('button', { name: 'Clear History' }).click();
  }

  /**
   * Cancel clearing history in the confirmation modal
   */
  async cancelClearHistory(): Promise<void> {
    const modal = this.getClearHistoryModal();
    await modal.getByRole('button', { name: 'Cancel' }).click();
  }

  /**
   * Get the empty state container (when no usage data)
   */
  getEmptyState(): Locator {
    return this.page.locator('[aria-label="Empty analytics"]');
  }

  /**
   * Get the error alert container
   */
  getErrorAlert(): Locator {
    return this.page.getByRole('alert');
  }

  /**
   * Get the Analytics tab header
   */
  getAnalyticsHeader(): Locator {
    return this.page.getByRole('heading', { name: 'Analytics' });
  }

  /**
   * Get the Analytics Dashboard header (full page view)
   */
  getDashboardHeader(): Locator {
    return this.page.getByRole('heading', { name: 'Analytics Dashboard' });
  }

  /**
   * Get the back button in the header
   */
  getBackButton(): Locator {
    return this.page.getByRole('button', { name: 'Go back' });
  }

  /**
   * Navigate back from the dashboard or tab
   */
  async navigateBack(): Promise<void> {
    await this.getBackButton().click();
  }

  /**
   * Get the usage trend section in the full dashboard
   */
  getUsageTrendSection(): Locator {
    return this.page.locator('section[aria-label="Usage trend"]');
  }

  /**
   * Get the breakdown charts section in the full dashboard
   */
  getBreakdownSection(): Locator {
    return this.page.locator('section[aria-label="Usage breakdown"]');
  }

  /**
   * Get the prompts table section in the full dashboard
   */
  getPromptsSection(): Locator {
    return this.page.locator('section[aria-label="Prompt usage details"]');
  }

  /**
   * Get the tab panel content area in the full dashboard
   */
  getTabPanel(): Locator {
    return this.page.getByRole('tabpanel');
  }

  /**
   * Get all prompt items in the current tab panel
   */
  getPromptItems(): Locator {
    return this.getTabPanel().locator('ul li');
  }
}
