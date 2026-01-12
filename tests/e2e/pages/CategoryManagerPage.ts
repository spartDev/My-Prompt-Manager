import type { Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the Category Manager modal
 * Handles all category CRUD operations
 */
export class CategoryManagerPage extends BasePage {

  /**
   * Open category manager from the library page
   */
  async openFromLibrary(): Promise<void> {
    await this.page.getByRole('button', { name: 'Manage categories' }).click();
    await this.expectCategoryManagerOpen();
  }

  /**
   * Close category manager and return to library
   * CategoryManager uses a Back button, not a Close button
   */
  async closeToLibrary(): Promise<void> {
    const backButton = this.getBackButton();
    await expect(backButton).toBeVisible();
    await backButton.click();
    await expect(this.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  }

  /**
   * Create a new category
   */
  async createCategory(name: string, color?: string): Promise<void> {
    const nameInput = this.page.getByPlaceholder('Enter category name...');
    await nameInput.fill(name);

    if (color) {
      // Color picker logic would go here if implemented
      // For now, the default color will be used
    }

    const addButton = this.page.getByRole('button', { name: 'Add' });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(this.getSuccessMessage('Category created successfully')).toBeVisible();

    // Verify input is cleared
    await expect(nameInput).toHaveValue('');
  }

  /**
   * Edit an existing category name
   */
  async editCategory(currentName: string, newName: string): Promise<void> {
    const categoryRow = this.getCategoryRow(currentName);
    await categoryRow.hover();
    await categoryRow.getByRole('button', { name: 'Edit category' }).click();

    // Fill new name in the edit input
    const editInput = this.page.getByPlaceholder('Category name', { exact: true });
    await editInput.clear();
    await editInput.fill(newName);

    await this.page.getByRole('button', { name: 'Save changes (Enter)' }).click();
    await expect(this.getSuccessMessage('Category updated successfully')).toBeVisible();

    // Verify name changed
    await expect(this.page.getByText(newName)).toBeVisible();
    await expect(this.page.getByText(currentName)).toBeHidden();
  }

  /**
   * Delete a category
   */
  async deleteCategory(name: string, confirmDelete: boolean = true): Promise<void> {
    const categoryRow = this.getCategoryRow(name);
    await categoryRow.hover();
    await categoryRow.getByRole('button', { name: 'Delete category' }).click();

    await expect(this.page.getByRole('heading', { name: 'Delete Category' })).toBeVisible();

    if (confirmDelete) {
      await this.page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(this.getSuccessMessage('Category deleted successfully')).toBeVisible();
      await expect(this.page.getByText(name)).toBeHidden();
    } else {
      await this.page.getByRole('button', { name: 'Cancel' }).click();
    }
  }

  /**
   * Get a category row by name using data-testid attribute
   */
  getCategoryRow(name: string): Locator {
    return this.page.getByTestId('category-row')
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first();
  }

  /**
   * Hover over a category to reveal action buttons
   */
  async hoverOverCategory(name: string): Promise<void> {
    const categoryRow = this.getCategoryRow(name);
    await categoryRow.hover();
  }

  /**
   * Expect the category manager to be open
   */
  async expectCategoryManagerOpen(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
    await expect(this.page.getByText('Organize your prompt collection')).toBeVisible();
  }

  /**
   * Expect a specific number of categories
   */
  async expectCategoryCount(count: number): Promise<void> {
    const text = count === 1 ? '1 category' : `${String(count)} categories`;
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /**
   * Expect a category to exist
   */
  async expectCategoryExists(name: string): Promise<void> {
    const categoryRow = this.getCategoryRow(name);
    await expect(categoryRow).toBeVisible();
  }

  /**
   * Expect a category to not exist
   */
  async expectCategoryNotExists(name: string): Promise<void> {
    const categoryRow = this.getCategoryRow(name);
    await expect(categoryRow).toBeHidden();
  }

  /**
   * Expect validation error message
   */
  async expectValidationError(message: string): Promise<void> {
    await expect(this.getErrorMessage(message)).toBeVisible();
  }

  /**
   * Get the category name input field
   */
  getCategoryNameInput(): Locator {
    return this.page.getByPlaceholder('Enter category name...');
  }

  /**
   * Get the add category button
   */
  getAddButton(): Locator {
    return this.page.getByRole('button', { name: 'Add' });
  }

  /**
   * Expect add button to be enabled/disabled
   */
  async expectAddButtonEnabled(enabled: boolean = true): Promise<void> {
    if (enabled) {
      await expect(this.getAddButton()).toBeEnabled();
    } else {
      await expect(this.getAddButton()).toBeDisabled();
    }
  }

  /**
   * Test category name validation by attempting to create a duplicate
   */
  async testDuplicateValidation(existingName: string): Promise<void> {
    await this.getCategoryNameInput().fill(existingName);
    await this.getAddButton().click();
    await this.expectValidationError('⚠️ Category already exists');
  }
}