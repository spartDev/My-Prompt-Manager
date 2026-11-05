import type { Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the main prompt library view
 * This is the primary interface users interact with
 */
export class LibraryPage extends BasePage {
  /**
   * Navigate to the settings page
   */
  async navigateToSettings(): Promise<void> {
    await this.switchToSection('settings');
  }

  /**
   * Navigate to the category manager
   */
  async navigateToCategoryManager(): Promise<void> {
    await this.switchToSection('categories');
  }

  /**
   * Navigate to the Analytics section
   */
  async navigateToAnalytics(): Promise<void> {
    await this.switchToSection('analytics');
  }

  /**
   * Search for prompts using the search input
   */
  async searchPrompts(query: string): Promise<void> {
    const searchField = this.page.getByPlaceholder('Search your prompts...');
    await searchField.fill(query);
    // Wait for search results to update
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get a Library filter pill ("All", "Pinned", "Most Used" or a Category name)
   */
  getLibraryFilterPill(name: string): Locator {
    return this.page
      .getByRole('radiogroup', { name: 'Library filter' })
      .getByRole('radio', { name, exact: true });
  }

  /**
   * Choose a Library filter pill ("All", "Pinned", "Most Used" or a Category name)
   */
  async selectLibraryFilter(name: string): Promise<void> {
    await this.getLibraryFilterPill(name).click();
    await expect(this.getLibraryFilterPill(name)).toHaveAttribute('aria-checked', 'true');
  }

  /**
   * Filter prompts by category
   */
  async filterByCategory(category: string): Promise<void> {
    await this.selectLibraryFilter(category);
  }

  /**
   * Clear all filters and search
   */
  async clearFilters(): Promise<void> {
    await this.selectLibraryFilter('All');
    await this.page.getByPlaceholder('Search your prompts...').clear();
  }

  /**
   * Get the header "New" button (opens the Add Prompt form)
   */
  getNewPromptButton(): Locator {
    return this.page.getByTestId('new-prompt-button');
  }

  /**
   * Click the header "New" button
   */
  async clickAddNewPrompt(): Promise<void> {
    await this.getNewPromptButton().click();
  }

  /**
   * Get the library header subtitle that shows the prompt count
   * ("12 prompts" or "3 of 12 prompts")
   */
  getPromptCountSubtitle(): Locator {
    return this.page.getByText(/^(\d+ of )?\d+ prompts?$/);
  }

  /**
   * Get all prompt cards using data-testid
   */
  getPromptCards(): Locator {
    return this.page.getByTestId('prompt-card');
  }

  /**
   * Get a specific prompt card by title using role-based locators
   */
  getPromptCard(title: string): Locator {
    return this.page.getByTestId('prompt-card')
      .filter({ has: this.page.getByRole('heading', { name: title }) })
      .first();
  }

  /**
   * Expect the empty state to be visible
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.page.getByText('No matches found')).toBeVisible();
  }

  /**
   * Expect a specific number of prompts to be visible
   */
  async expectPromptCount(count: number): Promise<void> {
    await expect(this.getPromptCards()).toHaveCount(count);
  }

  /**
   * Expect a specific prompt to be visible
   */
  async expectPromptVisible(title: string): Promise<void> {
    const promptCard = this.getPromptCard(title);
    await expect(promptCard).toBeVisible();
  }

  /**
   * Expect the library heading to be visible (page loaded)
   */
  async expectLibraryLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  }

  /**
   * Open a prompt for editing (clicking the card opens the editor)
   */
  async editPrompt(promptTitle: string): Promise<void> {
    await this.getPromptCard(promptTitle).getByRole('button', { name: /^Edit / }).click();
  }

  /**
   * Delete a prompt (from its edit form)
   */
  async deletePrompt(promptTitle: string): Promise<void> {
    await this.editPrompt(promptTitle);
    await this.page.getByRole('button', { name: 'Delete prompt' }).click();
  }

  /**
   * Pin or unpin a prompt with its star
   */
  async togglePin(promptTitle: string): Promise<void> {
    await this.getPromptCard(promptTitle).getByRole('button', { name: /^(Pin|Unpin) / }).click();
  }

  /**
   * Titles of the prompt cards, in display order
   */
  async getPromptTitles(): Promise<string[]> {
    return this.page.getByTestId('prompt-card').locator('h3').allInnerTexts();
  }

  /**
   * Verify each category has a Library filter pill
   */
  async expectCategoryFilterOptions(categories: string[]): Promise<void> {
    for (const category of categories) {
      await expect(this.getLibraryFilterPill(category)).toBeAttached();
    }
  }
}