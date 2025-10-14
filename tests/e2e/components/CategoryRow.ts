import type { Locator, Page } from '@playwright/test';

/**
 * CategoryRow Component
 *
 * Represents a single category row in the category manager.
 *
 * Responsibilities:
 * - Row-level interactions (edit, delete, hover)
 * - Element queries (name input, color picker, buttons)
 * - Actions (save edits, cancel, change color)
 *
 * Does NOT:
 * - Navigate to other pages (parent page does that)
 * - Contain assertions (tests do that)
 */
export class CategoryRow {
  constructor(private readonly locator: Locator) {}

  private get page(): Page {
    return this.locator.page();
  }

  // ==================
  // ELEMENT QUERIES
  // ==================

  get nameInput(): Locator {
    return this.locator.getByTestId('category-row-name-input');
  }

  get editButton(): Locator {
    return this.locator.getByTestId('category-row-edit-button');
  }

  get deleteButton(): Locator {
    return this.locator.getByTestId('category-row-delete-button');
  }

  get saveButton(): Locator {
    return this.locator.getByTestId('category-row-save-button');
  }

  get cancelButton(): Locator {
    return this.locator.getByTestId('category-row-cancel-button');
  }

  // ==================
  // ACTIONS
  // ==================

  /**
   * Click edit button to enter edit mode
   */
  async startEdit(): Promise<void> {
    await this.editButton.click();
  }

  /**
   * Change the category name
   */
  async setName(name: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
  }

  /**
   * Save changes
   */
  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Cancel editing
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /**
   * Delete this category
   */
  async delete(): Promise<void> {
    await this.deleteButton.click();
  }

  /**
   * Edit category with new name
   * Convenience method that combines startEdit, setName, and save
   */
  async edit(newName: string): Promise<void> {
    await this.startEdit();
    await this.setName(newName);
    await this.save();
  }

  // ==================
  // QUERIES
  // ==================

  /**
   * Get the category name
   */
  async getName(): Promise<string> {
    return (await this.nameInput.inputValue()) || '';
  }

  /**
   * Check if in edit mode
   */
  async isInEditMode(): Promise<boolean> {
    return this.saveButton.isVisible();
  }

  /**
   * Check if row is visible
   */
  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /**
   * Get the category ID from data attribute
   */
  async getCategoryId(): Promise<string> {
    return (await this.locator.getAttribute('data-category-id')) || '';
  }
}
