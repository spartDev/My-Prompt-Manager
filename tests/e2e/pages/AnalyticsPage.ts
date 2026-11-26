import type { Locator } from '@playwright/test';

import { clickToClose } from '../utils/closingClick';

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
    await this.switchToSection('analytics');
  }

  /**
   * Open the full dashboard view from the Analytics tab
   */
  async openFullDashboard(): Promise<void> {
    const expandButton = this.getExpandDashboardButton();
    await expandButton.click();
  }

  /**
   * The dark hero of the Analytics tab: Prompts used, its subtitle and the weekday bars
   */
  getHero(): Locator {
    return this.page.getByTestId('stats-hero');
  }

  /** The line under the total: the busiest weekday, a hovered bar's count, or no usage yet */
  getHeroSubtitle(): Locator {
    return this.page.getByTestId('stats-hero-subtitle');
  }

  /** The animated total of the hero */
  getHeroTotal(): Locator {
    return this.page.getByTestId('stats-total');
  }

  /** The seven weekday bars, Monday to Sunday */
  getWeekdayBars(): Locator {
    return this.page.getByTestId('stats-bar');
  }

  /**
   * The Top platform or Top category card of the Analytics tab
   */
  getStatCard(label: 'Top platform' | 'Top category'): Locator {
    return this.page.locator('div').filter({ has: this.page.getByRole('heading', { name: label, exact: true }) }).last();
  }

  /** The Most used card of the Analytics tab */
  getMostUsedCard(): Locator {
    return this.page.getByRole('region', { name: 'Most used' });
  }

  /** The rows of the Most used card: buttons that open their Prompt in the tab, plain rows in the full-page view */
  getMostUsedRows(): Locator {
    return this.page.getByTestId('most-used-row');
  }

  /** The Tidy up callout of the Analytics tab */
  getTidyUp(): Locator {
    return this.page.getByTestId('tidy-up');
  }

  /**
   * Get the "Full Dashboard" header button (sidepanel only, when there is data)
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
   * Confirm clearing history in the confirmation modal, and wait until the clear is done: the modal
   * closes once the history is written empty (AnalyticsTab, handleClearHistory). The write is not
   * done when the click returns: the clear first waits for the usage history's lock, shared with the
   * other contexts of the extension (UsageTracker), so a read of storage at once can still see the
   * history
   */
  async confirmClearHistory(): Promise<void> {
    await this.getClearHistoryButton().click();
    const modal = this.getClearHistoryModal();
    await modal.waitFor({ state: 'visible' });
    await modal.getByRole('button', { name: 'Clear History' }).click();
    await modal.waitFor({ state: 'hidden' });
  }

  /**
   * Cancel clearing history in the confirmation modal
   */
  async cancelClearHistory(): Promise<void> {
    const modal = this.getClearHistoryModal();
    await modal.getByRole('button', { name: 'Cancel' }).click();
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
   * The title of the full-page Analytics view: the same Section header as the tab
   */
  getDashboardHeader(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Analytics' });
  }

  /**
   * Get the back button in the full dashboard header
   * (the Analytics section itself has no back button; use the tab bar)
   */
  getBackButton(): Locator {
    return this.page.getByRole('button', { name: 'Go back' });
  }

  /**
   * Navigate back from the full dashboard: Go back closes its page, and this resolves once it has closed
   */
  async navigateBack(): Promise<void> {
    await clickToClose(this.page, this.getBackButton());
  }

  /**
   * Return from the Analytics section to the Library via the tab bar
   */
  async navigateToLibrary(): Promise<void> {
    await this.switchToSection('library');
  }

  /** A card of ranked rows in the full-page view */
  getRankedCard(title: 'Platforms' | 'Categories'): Locator {
    return this.page.getByRole('region', { name: title });
  }

  /** The rows of a card of ranked rows, most used first */
  getRankedRows(title: 'Platforms' | 'Categories'): Locator {
    return this.getRankedCard(title).getByTestId('ranked-row');
  }

  /** A chart card of the full-page view */
  getChartCard(title: 'Daily use' | 'Time of day'): Locator {
    return this.page.getByRole('region', { name: title });
  }

  /** A Review button of Tidy up, by what it reviews */
  getReviewButton(what: RegExp): Locator {
    return this.getTidyUp().getByRole('button', { name: what });
  }
}
