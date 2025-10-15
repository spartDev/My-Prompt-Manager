import type { Locator, Page } from '@playwright/test';

/**
 * SearchBar Component
 *
 * Represents the search input used throughout the application.
 * Can be used in LibraryPage, SettingsPage, etc.
 *
 * Responsibilities:
 * - Search input interactions
 * - Clear button interaction
 * - Query current search value
 *
 * Does NOT:
 * - Trigger search (parent handles that)
 * - Contain assertions (tests do that)
 */
export class SearchBar {
  constructor(private readonly page: Page) {}

  // ==================
  // ELEMENT QUERIES
  // ==================

  /**
   * Get the search input element
   */
  get input(): Locator {
    return this.page.getByTestId('search-input');
  }

  /**
   * Get the clear button (only visible when there's text)
   */
  get clearButton(): Locator {
    return this.page.getByTestId('search-clear-button');
  }

  // ==================
  // ACTIONS
  // ==================

  /**
   * Type text into the search input
   */
  async search(query: string): Promise<void> {
    await this.input.fill(query);
  }

  /**
   * Clear the search input by clicking the clear button
   */
  async clear(): Promise<void> {
    await this.clearButton.click();
  }

  /**
   * Clear the search input by filling with empty string
   */
  async clearByFill(): Promise<void> {
    await this.input.clear();
  }

  // ==================
  // QUERIES
  // ==================

  /**
   * Get the current search value
   */
  async getValue(): Promise<string> {
    return (await this.input.inputValue()) || '';
  }

  /**
   * Check if the search input is visible
   */
  async isVisible(): Promise<boolean> {
    return this.input.isVisible();
  }

  /**
   * Check if the clear button is visible
   */
  async isClearButtonVisible(): Promise<boolean> {
    return this.clearButton.isVisible();
  }
}
