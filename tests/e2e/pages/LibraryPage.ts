import type { Locator } from '@playwright/test';

import { PromptCard, SearchBar } from '../components';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the main prompt library view
 * This is the primary interface users interact with
 *
 * Responsibilities:
 * - Page-level navigation
 * - Provide access to components (PromptCard, SearchBar, etc.)
 * - Coordinate page-level actions
 *
 * Does NOT:
 * - Contain assertions (tests do that)
 * - Duplicate component methods (components handle their own interactions)
 */
export class LibraryPage extends BasePage {


  /**
   * Navigate to the settings page
   */
  async navigateToSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings' }).click();
    // Wait for settings page to load
    await this.page.getByRole('heading', { name: 'Settings' }).waitFor({ state: 'visible' });
  }

  /**
   * Navigate to the category manager
   */
  async navigateToCategoryManager(): Promise<void> {
    await this.page.getByRole('button', { name: 'Manage categories' }).click();
    // Wait for category manager to load
    await this.page.getByRole('heading', { name: 'Manage Categories' }).waitFor({ state: 'visible' });
  }

  /**
   * Search for prompts using the search input
   * Convenience method that delegates to SearchBar component
   */
  async searchPrompts(query: string): Promise<void> {
    await this.searchBar().search(query);
    // Wait for search results to update
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Filter prompts by category
   */
  async filterByCategory(category: string): Promise<void> {
    await this.page.locator('select').filter({ hasText: 'All Categories' }).selectOption(category);
  }

  /**
   * Clear all filters and search
   * Convenience method that clears both category filter and search
   */
  async clearFilters(): Promise<void> {
    await this.page.locator('select').selectOption('');
    await this.searchBar().clearByFill();
  }

  /**
   * Click the "Add new prompt" button
   */
  async clickAddNewPrompt(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add new prompt' }).click();
  }

  // ==================
  // COMPONENT ACCESS
  // ==================

  /**
   * Get the SearchBar component instance
   */
  searchBar(): SearchBar {
    return new SearchBar(this.page);
  }

  /**
   * Get all prompt card elements as Locator (for counting, waiting, etc.)
   */
  get promptCards(): Locator {
    return this.page.getByTestId('prompt-card');
  }

  /**
   * Get a specific prompt card component by title
   * Returns a PromptCard component instance for interaction
   */
  promptCard(title: string): PromptCard {
    const locator = this.page
      .getByTestId('prompt-card')
      .filter({ hasText: title })
      .first();
    return new PromptCard(locator);
  }

  /**
   * Get all prompt cards as component instances
   */
  async allPromptCards(): Promise<PromptCard[]> {
    const locators = await this.page.getByTestId('prompt-card').all();
    return locators.map(loc => new PromptCard(loc));
  }

}