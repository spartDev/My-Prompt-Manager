import type { Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the main prompt library view
 * This is the primary interface users interact with
 */
export class LibraryPage extends BasePage {
  // Selectors
  private readonly headingSelector = 'heading[name="My Prompt Manager"]';
  private readonly addNewPromptButton = 'button[name="Add new prompt"]';
  private readonly manageCategoriesButton = 'button[name="Manage categories"]';
  private readonly settingsButton = 'button[name="Settings"]';
  private readonly searchInput = 'input[placeholder="Search your prompts..."]';
  private readonly categoryFilter = 'select';
  private readonly promptCards = 'article';


  /**
   * Navigate to the settings page
   */
  async navigateToSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings' }).click();
    await expect(this.page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }

  /**
   * Navigate to the category manager
   */
  async navigateToCategoryManager(): Promise<void> {
    await this.page.getByRole('button', { name: 'Manage categories' }).click();
    await expect(this.page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
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
   * Filter prompts by category
   */
  async filterByCategory(category: string): Promise<void> {
    // Click the filter button to open dropdown
    await this.page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await this.page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Click the category option
    await this.page.getByRole('menuitem', { name: category }).click();
  }

  /**
   * Clear all filters and search
   */
  async clearFilters(): Promise<void> {
    // Click the filter button to open dropdown
    await this.page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await this.page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Click "All Categories" to clear
    await this.page.getByRole('menuitem', { name: 'All Categories' }).click();
    // Clear search
    await this.page.getByPlaceholder('Search your prompts...').clear();
  }

  /**
   * Click the "Add new prompt" button
   */
  async clickAddNewPrompt(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add new prompt' }).click();
  }

  /**
   * Get all prompt cards
   */
  getPromptCards(): Locator {
    return this.page.locator('article');
  }

  /**
   * Get a specific prompt card by title
   */
  getPromptCard(title: string): Locator {
    return this.page.locator('article').filter({ hasText: title }).first();
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
   * Open actions menu for a specific prompt
   */
  async openPromptActionsMenu(promptTitle: string): Promise<void> {
    const promptCard = this.getPromptCard(promptTitle);
    await promptCard.getByRole('button', { name: 'More actions' }).click();
  }

  /**
   * Click edit action for a specific prompt
   */
  async editPrompt(promptTitle: string): Promise<void> {
    await this.openPromptActionsMenu(promptTitle);
    await this.page.getByRole('menuitem', { name: 'Edit' }).click();
  }

  /**
   * Click delete action for a specific prompt
   */
  async deletePrompt(promptTitle: string): Promise<void> {
    await this.openPromptActionsMenu(promptTitle);
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
  }

  /**
   * Verify category count in the filter dropdown
   */
  async expectCategoryFilterOptions(categories: string[]): Promise<void> {
    // Open the filter dropdown
    await this.page.getByRole('button', { name: /Filter by category:/i }).click();
    // Wait for menu to appear
    await this.page.getByRole('menu', { name: 'Category filter menu' }).waitFor();
    // Verify each category exists in the menu
    for (const category of categories) {
      await expect(this.page.getByRole('menuitem', { name: category })).toBeVisible();
    }
    // Close the menu by pressing Escape
    await this.page.keyboard.press('Escape');
  }
}