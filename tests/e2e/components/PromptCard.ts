import type { Locator, Page } from '@playwright/test';

/**
 * PromptCard Component
 *
 * Represents a single prompt card in the library.
 * Can be used in LibraryPage, SearchResults, CategoryView.
 *
 * Responsibilities:
 * - Card-level interactions (click, hover, menu)
 * - Element queries (title, category, content preview)
 * - Actions (edit, delete, copy, share)
 *
 * Does NOT:
 * - Navigate to other pages (parent page does that)
 * - Contain assertions (tests do that)
 */
export class PromptCard {
  constructor(private readonly _locator: Locator) {}

  /**
   * Get the page this card belongs to
   */
  private get page(): Page {
    return this._locator.page();
  }

  /**
   * Get the underlying locator for this card (for use in test assertions)
   */
  get locator(): Locator {
    return this._locator;
  }

  // ==================
  // ELEMENT QUERIES
  // ==================

  /**
   * Get the prompt title element
   */
  get title(): Locator {
    return this._locator.getByTestId('prompt-card-title');
  }

  /**
   * Get the category badge
   */
  get category(): Locator {
    return this._locator.getByTestId('prompt-card-category-badge');
  }

  /**
   * Get the copy button
   */
  get copyButton(): Locator {
    return this._locator.getByTestId('prompt-card-copy-button');
  }

  /**
   * Get the share button
   */
  get shareButton(): Locator {
    return this._locator.getByTestId('prompt-card-share-button');
  }

  /**
   * Get the more actions button
   */
  private get moreActionsButton(): Locator {
    return this._locator.getByTestId('prompt-card-more-actions');
  }

  // ==================
  // ACTIONS
  // ==================

  /**
   * Click the card (opens preview or details)
   */
  async click(): Promise<void> {
    await this._locator.click();
  }

  /**
   * Open the actions menu
   */
  async openActionsMenu(): Promise<void> {
    await this.moreActionsButton.click();
  }

  /**
   * Edit this prompt
   */
  async edit(): Promise<void> {
    await this.openActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Edit' }).click();
  }

  /**
   * Delete this prompt
   */
  async delete(): Promise<void> {
    await this.openActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
  }

  /**
   * Copy this prompt to clipboard
   */
  async copy(): Promise<void> {
    await this.copyButton.click();
  }

  /**
   * Share this prompt
   */
  async share(): Promise<void> {
    await this.shareButton.click();
  }

  // ==================
  // QUERIES (return boolean/data)
  // ==================

  /**
   * Check if card is visible
   */
  async isVisible(): Promise<boolean> {
    return this._locator.isVisible();
  }

  /**
   * Get the prompt title text
   */
  async getTitleText(): Promise<string> {
    return (await this.title.textContent()) || '';
  }

  /**
   * Get the category name
   */
  async getCategoryName(): Promise<string> {
    return (await this.category.textContent()) || '';
  }

  /**
   * Get the prompt ID from data attribute
   */
  async getPromptId(): Promise<string> {
    return (await this._locator.getAttribute('data-prompt-id')) || '';
  }
}
